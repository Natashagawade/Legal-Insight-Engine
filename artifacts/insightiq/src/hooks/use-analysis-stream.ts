import { useState, useCallback } from 'react';
import { AnalysisResult } from '@workspace/api-client-react';

export type StreamStatus = 'idle' | 'analyzing' | 'completed' | 'error';

export interface StreamState {
  status: StreamStatus;
  progress: number;
  step: string;
  message: string;
  error?: string;
  resultId?: string;
  fullResult?: AnalysisResult;
}

async function consumeSSEStream(
  response: Response,
  onEvent: (event: Record<string, unknown>) => void,
  onError: (msg: string) => void
) {
  if (!response.body) throw new Error('ReadableStream not supported.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const dataStr = line.replace('data: ', '').trim();
        if (!dataStr) continue;
        const event = JSON.parse(dataStr) as Record<string, unknown>;
        if (event.type === 'error') { onError((event.message as string) || 'An error occurred.'); return; }
        onEvent(event);
        if (event.type === 'done') return;
      } catch (e) {
        console.warn('Failed to parse SSE event', e, line);
      }
    }
  }
}

export function useAnalysisStream() {
  const [state, setState] = useState<StreamState>({
    status: 'idle',
    progress: 0,
    step: 'Initializing',
    message: 'Preparing document for analysis...',
  });

  const handleEvent = useCallback((event: Record<string, unknown>) => {
    if (event.type === 'progress') {
      setState(prev => ({
        ...prev,
        progress: (event.progress as number) || prev.progress,
        step: (event.step as string) || prev.step,
        message: (event.message as string) || prev.message,
      }));
    } else if (event.type === 'result') {
      const data = event.data as AnalysisResult & { analysisId: string };
      setState(prev => ({ ...prev, resultId: data.analysisId, fullResult: data }));
    } else if (event.type === 'done') {
      setState(prev => ({ ...prev, status: 'completed', progress: 100 }));
    }
  }, []);

  const handleStreamError = useCallback((msg: string) => {
    setState(prev => ({ ...prev, status: 'error', error: msg }));
  }, []);

  const startAnalysis = useCallback(async (documentId: string) => {
    setState({ status: 'analyzing', progress: 5, step: 'Extracting', message: 'Reading document text...' });
    try {
      const response = await fetch(`/api/documents/${documentId}/analyze`, {
        method: 'POST',
        headers: { 'Accept': 'text/event-stream' },
      });
      if (!response.ok) throw new Error(`Failed to start analysis: ${response.statusText}`);
      await consumeSSEStream(response, handleEvent, handleStreamError);
    } catch (err: unknown) {
      handleStreamError(err instanceof Error ? err.message : 'Connection lost');
    }
  }, [handleEvent, handleStreamError]);

  const startTextAnalysis = useCallback(async (
    text: string,
    documentType: string,
    documentName?: string
  ) => {
    setState({ status: 'analyzing', progress: 5, step: 'Processing', message: 'Sending text for analysis...' });
    try {
      const response = await fetch('/api/documents/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({ text, documentType, documentName }),
      });
      if (!response.ok) throw new Error(`Failed to start analysis: ${response.statusText}`);
      await consumeSSEStream(response, handleEvent, handleStreamError);
    } catch (err: unknown) {
      handleStreamError(err instanceof Error ? err.message : 'Connection lost');
    }
  }, [handleEvent, handleStreamError]);

  const resetStream = useCallback(() => {
    setState({ status: 'idle', progress: 0, step: 'Initializing', message: 'Preparing document for analysis...' });
  }, []);

  return { ...state, startAnalysis, startTextAnalysis, resetStream };
}
