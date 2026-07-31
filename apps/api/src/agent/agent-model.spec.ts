import { FallbackAgentModel } from './agent-model';

describe('FallbackAgentModel', () => {
  const model = new FallbackAgentModel();

  it('classifies a crash report as a bug', async () => {
    await expect(
      model.classify({
        appId: 'app',
        conversationId: 'conversation',
        locale: 'zh-CN',
        message: '应用一打开就崩溃并且持续报错',
      }),
    ).resolves.toMatchObject({ intent: 'BUG', safe: true });
  });

  it('answers from sufficiently related knowledge', async () => {
    const result = await model.answer({
      appId: 'app',
      conversationId: 'conversation',
      locale: 'zh-CN',
      message: '怎么提交建议',
      knowledge: [
        {
          id: 'chunk',
          sourceId: 'source',
          title: '提交建议',
          content: '在反馈对话中描述场景、问题和期望结果。',
          score: 0.3,
        },
      ],
    });
    expect(result.answer).toBe('在反馈对话中描述场景、问题和期望结果。');
    expect(typeof result.confidence).toBe('number');
  });

  it('marks missing evidence with low confidence', async () => {
    const result = await model.answer({
      appId: 'app',
      conversationId: 'conversation',
      locale: 'en',
      message: 'Unknown question',
      knowledge: [],
    });
    expect(result.confidence).toBeLessThan(0.72);
    expect(result.answer).toContain("don't have enough");
  });
});
