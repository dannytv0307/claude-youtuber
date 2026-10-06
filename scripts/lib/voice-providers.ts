/** Text-to-speech backends. Each returns a 16-bit PCM WAV for one scene. */
import type { VideoSpec } from "../../src/schema/video-spec";
import { bearer, requireEnv, type VoicePreset } from "./ai-config";
import { firstInlineData, gemini, TTS_MODEL } from "./gemini";
import { httpFetch, runCommand, toPcmWav } from "./media";
import { pcmToWav } from "./wav";

export type VoiceRequest = { text: string; sceneId: string; spec: VideoSpec };

export const describeVoicePreset = (p: VoicePreset, spec: VideoSpec) => {
  switch (p.type) {
    case "gemini":
      return `gemini ${p.model ?? TTS_MODEL}, voice ${spec.voice.name}`;
    case "openai":
      return `openai ${p.model} @ ${p.baseUrl}, voice ${p.voice ?? spec.voice.name}`;
    case "elevenlabs":
      return `elevenlabs ${p.model}, voice ${p.voiceId}`;
    case "none":
      return "none (không tạo giọng)";
    case "command":
      return `command, voice ${p.voice ?? spec.voice.name}`;
  }
};

export const generateVoice = async (preset: VoicePreset, req: VoiceRequest): Promise<Buffer> => {
  const { spec, text } = req;

  switch (preset.type) {
    case "gemini": {
      const prompt = [
        `${spec.voice.styleInstruction} Tone: ${spec.style.tone}.`,
        `Speak in language ${spec.language}. Read the text below exactly as written, do not add or omit words:`,
        text,
      ].join("\n");
      const response = await gemini().models.generateContent({
        model: preset.model ?? TTS_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: spec.voice.name } } },
        },
      });
      // Gemini returns raw 24 kHz PCM
      return pcmToWav(firstInlineData(response).data);
    }

    case "openai": {
      const body = {
        model: preset.model,
        input: text,
        voice: preset.voice ?? spec.voice.name,
        response_format: "wav",
        ...(preset.useStyleInstruction ? { instructions: `${spec.voice.styleInstruction} Tone: ${spec.style.tone}.` } : {}),
        ...(preset.speed ? { speed: preset.speed } : {}),
        ...preset.extra,
      };
      const res = await httpFetch(`${preset.baseUrl.replace(/\/$/, "")}/audio/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearer(preset.apiKeyEnv, preset.baseUrl) },
        body: JSON.stringify(body),
      });
      return toPcmWav(Buffer.from(await res.arrayBuffer()));
    }

    case "elevenlabs": {
      const res = await httpFetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(preset.voiceId)}?output_format=pcm_24000`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": requireEnv(preset.apiKeyEnv) },
          body: JSON.stringify({ text, model_id: preset.model, ...preset.extra }),
        },
      );
      return pcmToWav(Buffer.from(await res.arrayBuffer()), 24000);
    }

    case "none":
      throw new Error("provider none không tạo giọng");

    case "command":
      return toPcmWav(
        runCommand(
          preset.command,
          preset.outputExt,
          { voice: preset.voice ?? spec.voice.name, language: spec.language },
          { text_file: text },
        ),
      );
  }
};
