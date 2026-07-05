/* =============================================================================
   GitHub-OAuth-Vermittler für Decap CMS  —  Cloudflare Worker
   -----------------------------------------------------------------------------
   Dieser Worker wird bei Cloudflare (kostenlos) deployt und ermöglicht den
   /admin-Login über GitHub. Er ist NICHT Teil der Website, sondern läuft
   separat bei Cloudflare. Diese Datei liegt nur zur Referenz im Repo.

   Benötigte Secrets im Worker (Cloudflare-Dashboard → Worker → Settings →
   Variables and Secrets):
     GITHUB_CLIENT_ID       = Client-ID der GitHub OAuth App
     GITHUB_CLIENT_SECRET   = Client-Secret der GitHub OAuth App

   In der GitHub OAuth App als "Authorization callback URL" eintragen:
     https://<dein-worker>.workers.dev/callback

   In admin/config.yml dann setzen:
     base_url: https://<dein-worker>.workers.dev
     auth_endpoint: auth
   ============================================================================= */

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1) Start des Logins: Weiterleitung zu GitHub
    if (url.pathname === '/auth') {
      const redirectUri = `${url.origin}/callback`;
      const authorize = new URL(AUTHORIZE_URL);
      authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      authorize.searchParams.set('redirect_uri', redirectUri);
      authorize.searchParams.set('scope', 'repo,user');
      authorize.searchParams.set('state', crypto.randomUUID());
      return Response.redirect(authorize.toString(), 302);
    }

    // 2) Rückweg von GitHub: Code gegen Token tauschen und ans CMS zurückmelden
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) return new Response('Fehlender code-Parameter', { status: 400 });

      const tokenResp = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'decap-cms-oauth',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const data = await tokenResp.json();

      const status = data.access_token ? 'success' : 'error';
      const payload = data.access_token
        ? { token: data.access_token, provider: 'github' }
        : data;
      const message = `authorization:github:${status}:${JSON.stringify(payload)}`;

      const html = `<!doctype html><html><body>
<script>
(function () {
  function receiveMessage(e) {
    window.opener.postMessage(${JSON.stringify(message)}, e.origin);
    window.removeEventListener('message', receiveMessage, false);
  }
  window.addEventListener('message', receiveMessage, false);
  // dem CMS signalisieren, dass wir bereit sind
  window.opener.postMessage('authorizing:github', '*');
})();
</script>
Anmeldung abgeschlossen, dieses Fenster kann geschlossen werden.
</body></html>`;

      return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    }

    return new Response('9elf CMS OAuth-Vermittler läuft.', {
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    });
  },
};
