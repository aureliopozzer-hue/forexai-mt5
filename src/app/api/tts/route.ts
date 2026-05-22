import { NextRequest, NextResponse } from 'next/server';

// Split long text into chunks of max 1000 characters at sentence boundaries
function splitTextIntoChunks(text: string, maxLength = 1000): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  let currentChunk = '';
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      // If a single sentence exceeds maxLength, split by comma
      if (sentence.length > maxLength) {
        const parts = sentence.split(/,\s*/);
        let subChunk = '';
        for (const part of parts) {
          if ((subChunk + part + ',').length <= maxLength) {
            subChunk += part + ', ';
          } else {
            if (subChunk) chunks.push(subChunk.trim());
            subChunk = part + ', ';
          }
        }
        currentChunk = subChunk;
      } else {
        currentChunk = sentence;
      }
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  return chunks;
}

// Singleton ZAI instance for reuse
let zaiInstance: any = null;
async function getZAI() {
  if (!zaiInstance) {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// Simple WAV header parser to extract raw PCM data
function parseWav(wavBuffer: Buffer): { sampleRate: number; bitsPerSample: number; channels: number; data: Buffer } {
  // RIFF header
  const riff = wavBuffer.toString('ascii', 0, 4);
  if (riff !== 'RIFF') throw new Error('Not a valid WAV file');

  // Find 'data' chunk
  let offset = 12;
  while (offset < wavBuffer.length - 8) {
    const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
    const chunkSize = wavBuffer.readUInt32LE(offset + 4);
    if (chunkId === 'data') {
      const fmtOffset = 12;
      // Find fmt chunk
      let fmtOff = 12;
      let audioFormat = 1;
      let channels = 1;
      let sampleRate = 24000;
      let bitsPerSample = 16;
      while (fmtOff < wavBuffer.length - 8) {
        const cId = wavBuffer.toString('ascii', fmtOff, fmtOff + 4);
        const cSize = wavBuffer.readUInt32LE(fmtOff + 4);
        if (cId === 'fmt ') {
          audioFormat = wavBuffer.readUInt16LE(fmtOff + 8);
          channels = wavBuffer.readUInt16LE(fmtOff + 10);
          sampleRate = wavBuffer.readUInt32LE(fmtOff + 12);
          bitsPerSample = wavBuffer.readUInt16LE(fmtOff + 22);
          break;
        }
        fmtOff += 8 + cSize;
      }
      return {
        sampleRate,
        bitsPerSample,
        channels,
        data: wavBuffer.subarray(offset + 8, offset + 8 + chunkSize),
      };
    }
    offset += 8 + chunkSize;
  }
  throw new Error('No data chunk found in WAV');
}

// Build a WAV buffer from raw PCM data
function buildWav(rawData: Buffer, sampleRate: number, bitsPerSample: number, channels: number): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + rawData.length);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + rawData.length, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(rawData.length, 40);
  rawData.copy(buffer, 44);

  return buffer;
}

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'kazi', speed = 1.0 } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      );
    }

    const zai = await getZAI();

    // Split text into chunks if needed (max 1024 chars per request)
    const chunks = splitTextIntoChunks(text.trim(), 1000);

    // Process chunks in PARALLEL for speed
    const audioPromises = chunks.map(async (chunk) => {
      const response = await zai.audio.tts.create({
        input: chunk,
        voice,
        speed: Math.max(0.5, Math.min(2.0, speed)),
        response_format: 'wav',
        stream: false,
      });
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(new Uint8Array(arrayBuffer));
    });

    const audioBuffers = await Promise.all(audioPromises);

    // If only one chunk, return directly (fast path)
    if (audioBuffers.length === 1) {
      return new NextResponse(audioBuffers[0], {
        status: 200,
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Length': audioBuffers[0].length.toString(),
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Multiple chunks: parse WAV headers, concatenate raw PCM, rebuild single WAV
    const parsed = audioBuffers.map(buf => parseWav(buf));

    // Verify all chunks have same format
    const first = parsed[0];
    const allSameFormat = parsed.every(p =>
      p.sampleRate === first.sampleRate &&
      p.bitsPerSample === first.bitsPerSample &&
      p.channels === first.channels
    );

    let totalBuffer: Buffer;

    if (allSameFormat) {
      // Concatenate raw PCM data and rebuild WAV
      const allData = Buffer.concat(parsed.map(p => p.data));
      totalBuffer = buildWav(allData, first.sampleRate, first.bitsPerSample, first.channels);
    } else {
      // Fallback: just concatenate raw WAV buffers (may have slight artifacts)
      totalBuffer = Buffer.concat(audioBuffers);
    }

    return new NextResponse(totalBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': totalBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('TTS API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
