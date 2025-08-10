export async function exec(cmd) {
  const res = await fetch('/ttp-ai-exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd })
  });
  return await res.json();
}