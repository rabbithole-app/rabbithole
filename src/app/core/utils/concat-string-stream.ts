/* eslint no-constant-condition: ["error", { "checkLoops": false }] */
export async function concatStringStream(stream: ReadableStream) {
    let result = '';
    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) return result;
        result += value;
    }
}
