// Desenvolvimento: mostra o link de redefinição de senha mais recente "enviado" pelo
// emulador do Auth, apontando para a página do app (/redefinir-senha).
// Uso: npm run dev:reset-link [-- e-mail] [-- --base=http://localhost:4200]
const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith('--'));
const base = (
  args.find((a) => a.startsWith('--base='))?.slice(7) ?? 'http://localhost:4200'
).replace(/\/$/, '');
const url = 'http://127.0.0.1:9099/emulator/v1/projects/demo-vanguarda-da-luz/oobCodes';

let body;
try {
  body = await (await fetch(url)).json();
} catch {
  console.error('Emulador do Auth não está rodando (npm run emulators).');
  process.exit(1);
}

const codes = (body.oobCodes ?? []).filter(
  (c) => c.requestType === 'PASSWORD_RESET' && (!email || c.email === email),
);
if (!codes.length) {
  console.error(`Nenhum link de redefinição${email ? ` para ${email}` : ''}.`);
  process.exit(1);
}
const last = codes[codes.length - 1];
console.log(`${last.email}:\n${base}/redefinir-senha?mode=resetPassword&oobCode=${last.oobCode}`);
