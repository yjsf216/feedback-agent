import 'dart:async';

import 'package:flutter/material.dart';

import 'chat_controller.dart';
import 'chat_theme.dart';
import 'models.dart';

/// Called when an app requires host SSO instead of guest or email access.
typedef FeedbackAuthenticationHandler =
    Future<FeedbackAuthSession?> Function(
      BuildContext context,
      FeedbackAppConfig config,
    );

/// Complete, embeddable feedback conversation UI.
class FeedbackChatView extends StatefulWidget {
  const FeedbackChatView({
    required this.controller,
    this.theme,
    this.authenticationHandler,
    this.onSourceTap,
    this.onClose,
    this.showContextPanel = true,
    super.key,
  });

  /// State and API coordinator owned by the host application.
  final FeedbackChatController controller;

  /// Optional visual override. The app's brand color is used by default.
  final FeedbackChatTheme? theme;

  /// Optional host SSO callback. Return tokens from a trusted backend exchange.
  final FeedbackAuthenticationHandler? authenticationHandler;

  /// Optional callback for opening a cited knowledge source.
  final ValueChanged<FeedbackKnowledgeSource>? onSourceTap;

  /// Optional close action rendered in the header.
  final VoidCallback? onClose;

  /// Whether wide layouts include the explanatory context rail.
  final bool showContextPanel;

  @override
  State<FeedbackChatView> createState() => _FeedbackChatViewState();
}

class _FeedbackChatViewState extends State<FeedbackChatView> {
  final TextEditingController _composer = TextEditingController();
  final ScrollController _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onControllerChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(widget.controller.initialize());
    });
  }

  @override
  void didUpdateWidget(covariant FeedbackChatView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller == widget.controller) return;
    oldWidget.controller.removeListener(_onControllerChanged);
    widget.controller.addListener(_onControllerChanged);
    unawaited(widget.controller.initialize());
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onControllerChanged);
    _composer.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onControllerChanged() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
      );
    });
  }

  Future<void> _submit([String? suggested]) async {
    final content = (suggested ?? _composer.text).trim();
    if (content.isEmpty) return;
    _composer.clear();
    await widget.controller.send(content);
    if (!mounted || widget.controller.phase != FeedbackChatPhase.authRequired) {
      return;
    }
    await _authenticate();
  }

  Future<void> _authenticate() async {
    final config = widget.controller.appConfig;
    if (config == null) return;

    final handler = widget.authenticationHandler;
    if (handler != null) {
      final session = await handler(context, config);
      if (session != null) await widget.controller.adoptSession(session);
      return;
    }

    if (config.auth.email) {
      await showDialog<void>(
        context: context,
        builder: (context) => _EmailIdentityDialog(
          controller: widget.controller,
          locale: widget.controller.locale,
        ),
      );
      return;
    }

    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(content: Text(_copy(widget.controller.locale, 'hostAuth'))),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        final config = widget.controller.appConfig;
        final chatTheme =
            widget.theme ??
            (config == null
                ? _fallbackTheme
                : FeedbackChatTheme.fromConfig(config));
        return Theme(
          data: chatTheme.materialTheme(),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final height = constraints.hasBoundedHeight
                  ? constraints.maxHeight
                  : 720.0;
              return SizedBox(
                height: height,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: chatTheme.surface,
                    border: Border.all(color: chatTheme.border),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: chatTheme.foreground.withValues(alpha: 0.08),
                        blurRadius: 34,
                        offset: const Offset(0, 18),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(23),
                    child: _content(chatTheme, constraints.maxWidth),
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  Widget _content(FeedbackChatTheme colors, double width) {
    final controller = widget.controller;
    if (controller.phase == FeedbackChatPhase.initializing ||
        controller.phase == FeedbackChatPhase.idle) {
      return _StatePanel(
        icon: Icons.forum_outlined,
        title: _copy(controller.locale, 'connecting'),
        busy: true,
        colors: colors,
      );
    }
    if (controller.phase == FeedbackChatPhase.error ||
        controller.appConfig == null) {
      return _StatePanel(
        icon: Icons.cloud_off_outlined,
        title: _copy(controller.locale, 'loadFailed'),
        detail: controller.lastError,
        actionLabel: _copy(controller.locale, 'retry'),
        onAction: controller.initialize,
        colors: colors,
      );
    }

    final wide = width >= 880 && widget.showContextPanel;
    return Column(
      children: [
        _Header(
          controller: controller,
          colors: colors,
          onAuthenticate: _authenticate,
          onClose: widget.onClose,
        ),
        Divider(height: 1, color: colors.border),
        Expanded(
          child: Row(
            children: [
              if (wide) ...[
                SizedBox(
                  width: 286,
                  child: _ContextRail(controller: controller, colors: colors),
                ),
                VerticalDivider(width: 1, color: colors.border),
              ],
              Expanded(child: _conversation(colors)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _conversation(FeedbackChatTheme colors) {
    final controller = widget.controller;
    final locale = controller.locale;
    return ColoredBox(
      color: colors.surface,
      child: Column(
        children: [
          if (controller.lastError != null)
            _ErrorBanner(
              message: controller.lastError!,
              colors: colors,
              onRetry:
                  controller.messages.any(
                    (message) =>
                        message.state == FeedbackChatMessageState.error,
                  )
                  ? controller.retryLastMessage
                  : null,
              retryLabel: _copy(locale, 'retry'),
            ),
          Expanded(
            child: ListView.builder(
              controller: _scroll,
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 14),
              itemCount: controller.messages.length,
              itemBuilder: (context, index) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _MessageBubble(
                  message: controller.messages[index],
                  colors: colors,
                  locale: locale,
                  onSourceTap: widget.onSourceTap,
                ),
              ),
            ),
          ),
          if (!controller.hasUserMessage)
            _Suggestions(
              values: controller.appConfig!.suggestionsFor(locale),
              colors: colors,
              onSelected: _submit,
            ),
          if (controller.hasUserMessage && !controller.isSending)
            _ResolutionCard(controller: controller, colors: colors),
          _Composer(
            controller: _composer,
            enabled: !controller.isSending,
            colors: colors,
            locale: locale,
            onSubmit: _submit,
          ),
        ],
      ),
    );
  }
}

/// Full-page wrapper for [FeedbackChatView].
class FeedbackChatPage extends StatelessWidget {
  const FeedbackChatPage({
    required this.controller,
    this.theme,
    this.authenticationHandler,
    this.onSourceTap,
    super.key,
  });

  final FeedbackChatController controller;
  final FeedbackChatTheme? theme;
  final FeedbackAuthenticationHandler? authenticationHandler;
  final ValueChanged<FeedbackKnowledgeSource>? onSourceTap;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        minimum: const EdgeInsets.all(12),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1180),
            child: FeedbackChatView(
              controller: controller,
              theme: theme,
              authenticationHandler: authenticationHandler,
              onSourceTap: onSourceTap,
              onClose: () => Navigator.of(context).maybePop(),
            ),
          ),
        ),
      ),
    );
  }
}

/// Compact launcher that opens the feedback chat in a modal sheet.
class FeedbackChatLauncher extends StatelessWidget {
  const FeedbackChatLauncher({
    required this.controller,
    this.theme,
    this.authenticationHandler,
    this.onSourceTap,
    this.label,
    super.key,
  });

  final FeedbackChatController controller;
  final FeedbackChatTheme? theme;
  final FeedbackAuthenticationHandler? authenticationHandler;
  final ValueChanged<FeedbackKnowledgeSource>? onSourceTap;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final locale = controller.locale;
    return FloatingActionButton.extended(
      onPressed: () => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (context) => FractionallySizedBox(
          heightFactor: 0.92,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 12),
            child: FeedbackChatView(
              controller: controller,
              theme: theme,
              authenticationHandler: authenticationHandler,
              onSourceTap: onSourceTap,
              onClose: () => Navigator.of(context).pop(),
              showContextPanel: false,
            ),
          ),
        ),
      ),
      icon: const Icon(Icons.forum_outlined),
      label: Text(label ?? _copy(locale, 'feedback')),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.controller,
    required this.colors,
    required this.onAuthenticate,
    this.onClose,
  });

  final FeedbackChatController controller;
  final FeedbackChatTheme colors;
  final VoidCallback onAuthenticate;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final locale = controller.locale;
    final config = controller.appConfig!;
    final authenticated = controller.session != null;
    return ColoredBox(
      color: colors.surface,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        child: Row(
          children: [
            if (onClose != null) ...[
              IconButton(
                tooltip: _copy(locale, 'close'),
                onPressed: onClose,
                icon: const Icon(Icons.arrow_back),
              ),
              const SizedBox(width: 4),
            ],
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: colors.primarySoft,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(Icons.auto_awesome_outlined, color: colors.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    config.name,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: colors.positive,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _copy(locale, 'online'),
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (MediaQuery.sizeOf(context).width >= 520)
              TextButton.icon(
                onPressed: authenticated ? null : onAuthenticate,
                icon: Icon(
                  authenticated
                      ? Icons.verified_user_outlined
                      : Icons.person_outline,
                  size: 18,
                ),
                label: Text(
                  authenticated
                      ? _copy(locale, 'identified')
                      : _copy(locale, 'identity'),
                ),
              ),
            IconButton(
              tooltip: _copy(locale, 'language'),
              onPressed: controller.isSending
                  ? null
                  : () => controller.setLocale(
                      locale == FeedbackLocale.zhCn
                          ? FeedbackLocale.en
                          : FeedbackLocale.zhCn,
                    ),
              icon: const Icon(Icons.translate_outlined),
            ),
            IconButton(
              tooltip: _copy(locale, 'newChat'),
              onPressed: controller.isSending
                  ? null
                  : controller.startNewConversation,
              icon: const Icon(Icons.add_comment_outlined),
            ),
          ],
        ),
      ),
    );
  }
}

class _ContextRail extends StatelessWidget {
  const _ContextRail({required this.controller, required this.colors});

  final FeedbackChatController controller;
  final FeedbackChatTheme colors;

  @override
  Widget build(BuildContext context) {
    final locale = controller.locale;
    final steps = locale == FeedbackLocale.zhCn
        ? const ['理解你的问题', '检索已验证知识', '整理反馈信号']
        : const [
            'Understand the issue',
            'Search verified knowledge',
            'Capture feedback',
          ];
    return ColoredBox(
      color: colors.surfaceMuted,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 30, 24, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.route_outlined, color: colors.primary, size: 28),
            const SizedBox(height: 18),
            Text(
              _copy(locale, 'contextTitle'),
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 10),
            Text(
              _copy(locale, 'contextBody'),
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: colors.mutedForeground),
            ),
            const SizedBox(height: 26),
            ...steps.indexed.map(
              (entry) => Padding(
                padding: const EdgeInsets.only(bottom: 15),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: colors.primarySoft,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${entry.$1 + 1}',
                        style: Theme.of(context).textTheme.labelMedium
                            ?.copyWith(color: colors.primary),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          entry.$2,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: colors.surface,
                border: Border.all(color: colors.border),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.shield_outlined, color: colors.primary, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _copy(locale, 'privacy'),
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.colors,
    required this.locale,
    this.onSourceTap,
  });

  final FeedbackChatMessage message;
  final FeedbackChatTheme colors;
  final FeedbackLocale locale;
  final ValueChanged<FeedbackKnowledgeSource>? onSourceTap;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == FeedbackChatRole.user;
    final bubble = Container(
      constraints: const BoxConstraints(maxWidth: 620),
      padding: const EdgeInsets.fromLTRB(15, 12, 15, 13),
      decoration: BoxDecoration(
        color: isUser ? colors.primary : colors.surfaceMuted,
        border: isUser ? null : Border.all(color: colors.border),
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(18),
          topRight: const Radius.circular(18),
          bottomLeft: Radius.circular(isUser ? 18 : 5),
          bottomRight: Radius.circular(isUser ? 5 : 18),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (message.content.isNotEmpty)
            SelectableText(
              message.content,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: isUser ? Colors.white : colors.foreground,
              ),
            ),
          if (message.state == FeedbackChatMessageState.streaming) ...[
            if (message.content.isNotEmpty) const SizedBox(height: 9),
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: colors.primary,
              ),
            ),
          ],
          if (!isUser && message.sources.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: message.sources
                  .map(
                    (source) => ActionChip(
                      avatar: const Icon(
                        Icons.library_books_outlined,
                        size: 15,
                      ),
                      label: Text(source.title),
                      onPressed: onSourceTap == null
                          ? null
                          : () => onSourceTap!(source),
                    ),
                  )
                  .toList(growable: false),
            ),
          ],
          if (!isUser && message.confidence != null) ...[
            const SizedBox(height: 10),
            Text(
              '${_copy(locale, 'confidence')} ${(message.confidence! * 100).round()}%',
              style: Theme.of(
                context,
              ).textTheme.labelMedium?.copyWith(color: colors.mutedForeground),
            ),
          ],
        ],
      ),
    );

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: isUser
          ? bubble
          : Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 31,
                  height: 31,
                  decoration: BoxDecoration(
                    color: colors.primarySoft,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    Icons.auto_awesome_outlined,
                    size: 17,
                    color: colors.primary,
                  ),
                ),
                const SizedBox(width: 9),
                Flexible(child: bubble),
              ],
            ),
    );
  }
}

class _Suggestions extends StatelessWidget {
  const _Suggestions({
    required this.values,
    required this.colors,
    required this.onSelected,
  });

  final List<String> values;
  final FeedbackChatTheme colors;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    if (values.isEmpty) return const SizedBox.shrink();
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
      child: Row(
        children: values
            .map(
              (value) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: OutlinedButton.icon(
                  onPressed: () => onSelected(value),
                  icon: Icon(Icons.north_east, size: 15, color: colors.primary),
                  label: Text(value),
                ),
              ),
            )
            .toList(growable: false),
      ),
    );
  }
}

class _ResolutionCard extends StatelessWidget {
  const _ResolutionCard({required this.controller, required this.colors});

  final FeedbackChatController controller;
  final FeedbackChatTheme colors;

  @override
  Widget build(BuildContext context) {
    final locale = controller.locale;
    final selected = controller.resolution;
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      decoration: BoxDecoration(
        color: selected == null ? colors.surfaceMuted : colors.primarySoft,
        border: Border.all(color: colors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: selected == null
          ? Row(
              children: [
                Expanded(
                  child: Text(
                    _copy(locale, 'resolvedQuestion'),
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                ),
                IconButton.outlined(
                  tooltip: _copy(locale, 'yes'),
                  onPressed: controller.isSubmittingResolution
                      ? null
                      : () => controller.markResolution(true),
                  icon: Icon(Icons.check, color: colors.positive),
                ),
                const SizedBox(width: 7),
                IconButton.outlined(
                  tooltip: _copy(locale, 'no'),
                  onPressed: controller.isSubmittingResolution
                      ? null
                      : () => controller.markResolution(false),
                  icon: Icon(Icons.priority_high, color: colors.negative),
                ),
              ],
            )
          : Row(
              children: [
                Icon(
                  selected
                      ? Icons.check_circle_outline
                      : Icons.task_alt_outlined,
                  color: selected ? colors.positive : colors.primary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _copy(
                      locale,
                      selected ? 'resolvedThanks' : 'followupThanks',
                    ),
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              ],
            ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.enabled,
    required this.colors,
    required this.locale,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool enabled;
  final FeedbackChatTheme colors;
  final FeedbackLocale locale;
  final Future<void> Function([String?]) onSubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 13, 14, 14),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              minLines: 1,
              maxLines: 4,
              textInputAction: TextInputAction.newline,
              decoration: InputDecoration(
                hintText: _copy(locale, 'placeholder'),
                suffixIcon: Icon(
                  Icons.lock_outline,
                  size: 17,
                  color: colors.mutedForeground,
                ),
              ),
            ),
          ),
          const SizedBox(width: 9),
          IconButton.filled(
            tooltip: _copy(locale, 'send'),
            onPressed: enabled ? onSubmit : null,
            icon: enabled
                ? const Icon(Icons.arrow_upward_rounded)
                : const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({
    required this.message,
    required this.colors,
    required this.retryLabel,
    this.onRetry,
  });

  final String message;
  final FeedbackChatTheme colors;
  final String retryLabel;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: colors.negative.withValues(alpha: 0.08),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: colors.negative, size: 19),
          const SizedBox(width: 9),
          Expanded(
            child: Text(message, style: Theme.of(context).textTheme.bodyMedium),
          ),
          if (onRetry != null)
            TextButton(onPressed: onRetry, child: Text(retryLabel)),
        ],
      ),
    );
  }
}

class _StatePanel extends StatelessWidget {
  const _StatePanel({
    required this.icon,
    required this.title,
    required this.colors,
    this.detail,
    this.busy = false,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? detail;
  final bool busy;
  final String? actionLabel;
  final VoidCallback? onAction;
  final FeedbackChatTheme colors;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: colors.canvas,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  color: colors.primarySoft,
                  borderRadius: BorderRadius.circular(19),
                ),
                child: Icon(icon, color: colors.primary, size: 28),
              ),
              const SizedBox(height: 18),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              if (detail != null) ...[
                const SizedBox(height: 8),
                Text(
                  detail!,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: colors.mutedForeground,
                  ),
                ),
              ],
              if (busy) ...[
                const SizedBox(height: 20),
                SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    color: colors.primary,
                    strokeWidth: 2.5,
                  ),
                ),
              ],
              if (onAction != null && actionLabel != null) ...[
                const SizedBox(height: 20),
                FilledButton(onPressed: onAction, child: Text(actionLabel!)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _EmailIdentityDialog extends StatefulWidget {
  const _EmailIdentityDialog({required this.controller, required this.locale});

  final FeedbackChatController controller;
  final FeedbackLocale locale;

  @override
  State<_EmailIdentityDialog> createState() => _EmailIdentityDialogState();
}

class _EmailIdentityDialogState extends State<_EmailIdentityDialog> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  bool _register = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_email.text.trim().isEmpty || _password.text.length < 8) {
      setState(() => _error = _copy(widget.locale, 'invalidIdentity'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_register) {
        await widget.controller.registerEmail(
          email: _email.text,
          password: _password.text,
          displayName: _name.text,
        );
      } else {
        await widget.controller.loginEmail(
          email: _email.text,
          password: _password.text,
        );
      }
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: const Icon(Icons.lock_person_outlined),
      title: Text(_copy(widget.locale, _register ? 'register' : 'login')),
      content: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 380),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_register) ...[
              TextField(
                controller: _name,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: _copy(widget.locale, 'displayName'),
                ),
              ),
              const SizedBox(height: 11),
            ],
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(
                labelText: _copy(widget.locale, 'email'),
              ),
            ),
            const SizedBox(height: 11),
            TextField(
              controller: _password,
              obscureText: true,
              onSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                labelText: _copy(widget.locale, 'password'),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.error,
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _busy
              ? null
              : () => setState(() {
                  _register = !_register;
                  _error = null;
                }),
          child: Text(
            _copy(widget.locale, _register ? 'useLogin' : 'useRegister'),
          ),
        ),
        FilledButton(
          onPressed: _busy ? null : _submit,
          child: _busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    color: Colors.white,
                    strokeWidth: 2,
                  ),
                )
              : Text(_copy(widget.locale, _register ? 'register' : 'login')),
        ),
      ],
    );
  }
}

const _fallbackTheme = FeedbackChatTheme(
  primary: Color(0xff0f766e),
  primarySoft: Color(0xffe1f2ed),
  canvas: Color(0xfff3f7f5),
  surface: Color(0xfffffefb),
  surfaceMuted: Color(0xfff3f6f3),
  foreground: Color(0xff182420),
  mutedForeground: Color(0xff64716c),
  border: Color(0xffdce5e0),
  positive: Color(0xff19724f),
  negative: Color(0xffb5473d),
);

String _copy(FeedbackLocale locale, String key) {
  return (_strings[locale] ?? _strings[FeedbackLocale.zhCn])![key] ?? key;
}

const _strings = <FeedbackLocale, Map<String, String>>{
  FeedbackLocale.zhCn: {
    'connecting': '正在连接反馈入口',
    'loadFailed': '暂时无法打开反馈入口',
    'retry': '重试',
    'online': '在线',
    'identified': '身份已连接',
    'identity': '登录',
    'language': '切换语言',
    'newChat': '新对话',
    'close': '返回',
    'contextTitle': '让反馈真正进入产品流程',
    'contextBody': '你可以提问、报告问题或提出建议。系统会保留上下文并整理为可跟进的反馈。',
    'privacy': 'AI 生成的需求仅作为草稿，必须由产品负责人确认。',
    'confidence': 'AI 置信度',
    'resolvedQuestion': '这个回答解决问题了吗？',
    'yes': '已解决',
    'no': '仍需帮助',
    'resolvedThanks': '感谢确认，这会帮助我们持续改进回答质量。',
    'followupThanks': '已进入待跟进队列，产品负责人可在管理台继续处理。',
    'placeholder': '描述你的问题、建议或遇到的困难…',
    'send': '发送',
    'feedback': '反馈与帮助',
    'hostAuth': '当前应用需要由宿主应用提供登录身份。',
    'login': '邮箱登录',
    'register': '创建反馈账号',
    'displayName': '怎么称呼你（可选）',
    'email': '邮箱',
    'password': '密码（至少 8 位）',
    'invalidIdentity': '请输入有效邮箱和至少 8 位密码。',
    'useLogin': '已有账号',
    'useRegister': '创建账号',
  },
  FeedbackLocale.en: {
    'connecting': 'Connecting to feedback',
    'loadFailed': 'This feedback entry is unavailable',
    'retry': 'Try again',
    'online': 'Online',
    'identified': 'Identity connected',
    'identity': 'Sign in',
    'language': 'Change language',
    'newChat': 'New conversation',
    'close': 'Back',
    'contextTitle': 'Turn feedback into product action',
    'contextBody':
        'Ask a question, report a problem, or suggest an improvement. Context is captured for product follow-up.',
    'privacy':
        'AI-generated requirements are drafts and always require product-owner approval.',
    'confidence': 'AI confidence',
    'resolvedQuestion': 'Did this answer solve your problem?',
    'yes': 'Solved',
    'no': 'Still need help',
    'resolvedThanks': 'Thanks — this helps us improve answer quality.',
    'followupThanks': 'Added to the follow-up queue for the product team.',
    'placeholder': 'Describe your question, idea, or what went wrong…',
    'send': 'Send',
    'feedback': 'Feedback & help',
    'hostAuth':
        'This app requires an identity supplied by the host application.',
    'login': 'Email sign in',
    'register': 'Create feedback account',
    'displayName': 'Display name (optional)',
    'email': 'Email',
    'password': 'Password (8+ characters)',
    'invalidIdentity':
        'Enter a valid email and a password of at least 8 characters.',
    'useLogin': 'Use existing account',
    'useRegister': 'Create account',
  },
};
