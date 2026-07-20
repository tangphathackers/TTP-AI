const TTP_SECRET_KEY = "ttp_secret_key";

async function generateHMAC(message, secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const msgData = encoder.encode(message);
    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function exec(cmd) {
  const payloadStr = JSON.stringify({ cmd });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 15);
  const signature = await generateHMAC(payloadStr + timestamp + nonce, TTP_SECRET_KEY);

  const res = await fetch('/ttp-ai-exec', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-TTP-Signature': signature,
      'X-TTP-Timestamp': timestamp,
      'X-TTP-Nonce': nonce
    },
    body: payloadStr
  });
  return await res.json();
}
