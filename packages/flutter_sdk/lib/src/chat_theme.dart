import 'package:flutter/material.dart';

import 'models.dart';

/// Semantic colors and typography for the bundled feedback chat UI.
class FeedbackChatTheme {
  const FeedbackChatTheme({
    required this.primary,
    required this.primarySoft,
    required this.canvas,
    required this.surface,
    required this.surfaceMuted,
    required this.foreground,
    required this.mutedForeground,
    required this.border,
    required this.positive,
    required this.negative,
  });

  /// Creates a calm, product-neutral theme from an application's brand color.
  factory FeedbackChatTheme.fromConfig(FeedbackAppConfig config) {
    final primary = feedbackColorFromHex(config.primaryColor);
    const canvas = Color(0xfff3f7f5);
    const surface = Color(0xfffffefb);
    return FeedbackChatTheme(
      primary: primary,
      primarySoft: Color.alphaBlend(primary.withValues(alpha: 0.12), surface),
      canvas: canvas,
      surface: surface,
      surfaceMuted: Color.alphaBlend(
        primary.withValues(alpha: 0.045),
        const Color(0xfff7f8f5),
      ),
      foreground: const Color(0xff182420),
      mutedForeground: const Color(0xff64716c),
      border: const Color(0xffdce5e0),
      positive: const Color(0xff19724f),
      negative: const Color(0xffb5473d),
    );
  }

  /// Primary application color.
  final Color primary;

  /// Low-emphasis brand tint.
  final Color primarySoft;

  /// Page background with a subtle cool-green temperature.
  final Color canvas;

  /// Main panel color.
  final Color surface;

  /// Secondary panel and assistant bubble color.
  final Color surfaceMuted;

  /// High-emphasis text.
  final Color foreground;

  /// Supporting text.
  final Color mutedForeground;

  /// Hairline and input border.
  final Color border;

  /// Resolved state color.
  final Color positive;

  /// Error and unresolved state color.
  final Color negative;

  /// Material theme used inside [FeedbackChatView].
  ThemeData materialTheme() {
    const fontFallback = <String>[
      'PingFang SC',
      'Noto Sans CJK SC',
      'Microsoft YaHei',
    ];
    final baseText = TextTheme(
      displaySmall: TextStyle(
        color: foreground,
        fontSize: 30,
        height: 1.12,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.7,
        fontFamilyFallback: fontFallback,
      ),
      headlineSmall: TextStyle(
        color: foreground,
        fontSize: 22,
        height: 1.25,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.3,
        fontFamilyFallback: fontFallback,
      ),
      titleLarge: TextStyle(
        color: foreground,
        fontSize: 18,
        height: 1.35,
        fontWeight: FontWeight.w700,
        fontFamilyFallback: fontFallback,
      ),
      titleMedium: TextStyle(
        color: foreground,
        fontSize: 15,
        height: 1.4,
        fontWeight: FontWeight.w600,
        fontFamilyFallback: fontFallback,
      ),
      bodyLarge: TextStyle(
        color: foreground,
        fontSize: 16,
        height: 1.55,
        fontWeight: FontWeight.w400,
        fontFamilyFallback: fontFallback,
      ),
      bodyMedium: TextStyle(
        color: foreground,
        fontSize: 14,
        height: 1.55,
        fontWeight: FontWeight.w400,
        fontFamilyFallback: fontFallback,
      ),
      labelLarge: TextStyle(
        color: foreground,
        fontSize: 14,
        height: 1.25,
        fontWeight: FontWeight.w600,
        fontFamilyFallback: fontFallback,
      ),
      labelMedium: TextStyle(
        color: mutedForeground,
        fontSize: 12,
        height: 1.35,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.1,
        fontFamilyFallback: fontFallback,
      ),
    );
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: canvas,
      colorScheme: ColorScheme.light(
        primary: primary,
        onPrimary: Colors.white,
        primaryContainer: primarySoft,
        onPrimaryContainer: foreground,
        surface: surface,
        onSurface: foreground,
        error: negative,
        outline: border,
        outlineVariant: border,
      ),
      textTheme: baseText,
      dividerColor: border,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: primary, width: 1.5),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: baseText.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(44, 44),
          side: BorderSide(color: border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: baseText.labelLarge,
        ),
      ),
    );
  }
}

/// Parses `#RRGGBB` or `#AARRGGBB`, falling back to deep teal.
Color feedbackColorFromHex(String value) {
  final normalized = value.replaceFirst('#', '');
  final parsed = int.tryParse(normalized, radix: 16);
  if (parsed == null || (normalized.length != 6 && normalized.length != 8)) {
    return const Color(0xff0f766e);
  }
  return Color(normalized.length == 6 ? 0xff000000 | parsed : parsed);
}
