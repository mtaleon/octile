'use strict';
// ──────────────────────────────────────────────
// Octile — source modules (src/*.js)
//
// Edit files in src/, then rebuild:
//   ./scripts/build.sh          # concat src/*.js → app.js, then minify
//   ./scripts/build.sh --dev    # concat only (skip minify)
//
// Files are numbered for concatenation order:
//   00-core      Error handler, localStorage, piece definitions
//   01-data      Puzzles, levels, navigation, board state
//   02-config    API URLs, version, fetch wrapper, config loader
//   03-sound-fx  Sound system, visual snap, canvas particles, haptics
//   04-infra     Turnstile, update check, OTA, offline queue, avatars
//   05-board     Timer, board rendering, drag/drop, piece placement
//   06-economy   Energy, EXP, diamonds, achievements, daily tasks
//   07-game      Scoreboard, encouragement, win flow, confetti
//   08-ui        Splash, welcome panel, tutorial, settings
//   09-auth      Auth, Google OAuth
//   10-profile   Player profile, ELO ranks
//   11-init      Event listeners, debug panel, startup sequence
//
// index.html loads app.min.js, NOT app.js.

// =====================================================================
// GLOBAL ERROR HANDLER — catches unhandled JS errors
// Shows user-friendly dialog with option to send feedback (policy-safe)
// =====================================================================
// Platform detection: Electron (Steam) vs web vs Android WebView
var _isElectron = typeof navigator === 'object' && navigator.userAgent.includes('Electron');

var _errorLog = [];
var _errorDialogShown = false;

window.onerror = function(msg, src, line, col, err) {
  // "Script error." at line 0 = cross-origin (extension, stale SW, etc.) — not actionable
  if (msg === 'Script error.' && !line) return true;
  var entry = { msg: msg, src: (src || '').split('/').pop(), line: line, col: col, ts: Date.now() };
  _errorLog.push(entry);
  if (_errorLog.length > 10) _errorLog.shift();
  console.error('[Octile Error]', msg, src, line, col);
  if (!_errorDialogShown) _showErrorDialog(entry);
  return true; // prevent default browser error
};

window.addEventListener('unhandledrejection', function(e) {
  var msg = e.reason ? (e.reason.message || String(e.reason)) : 'Unknown async error';
  var entry = { msg: msg, src: 'promise', line: 0, col: 0, ts: Date.now() };
  _errorLog.push(entry);
  if (_errorLog.length > 10) _errorLog.shift();
  console.error('[Octile Promise Error]', msg);
});

function _showErrorDialog(entry) {
  _errorDialogShown = true;
  // Build error info (no PII — only technical context)
  var info = 'Error: ' + entry.msg + '\nFile: ' + entry.src + ':' + entry.line +
    '\nVersion: ' + (typeof APP_VERSION_NAME !== 'undefined' ? APP_VERSION_NAME : '?') +
    '\nPlatform: ' + (/android/i.test(navigator.userAgent) ? 'android' : /iphone|ipad/i.test(navigator.userAgent) ? 'ios' : 'web') +
    '\nScreen: ' + window.innerWidth + 'x' + window.innerHeight;
  // Use setTimeout to avoid breaking during init
  setTimeout(function() {
    try {
      var lang = (typeof currentLang !== 'undefined' && currentLang === 'zh') ? 'zh' : 'en';
      var title = lang === 'zh' ? '發生錯誤' : 'Something went wrong';
      var desc = lang === 'zh' ? '遊戲遇到了問題。您可以回報此問題以協助我們修復。' : 'The game encountered an issue. You can report it to help us fix it.';
      var sendLabel = lang === 'zh' ? '回報問題' : 'Report Issue';
      var dismissLabel = lang === 'zh' ? '關閉' : 'Dismiss';
      var el = document.createElement('div');
      el.id = 'error-dialog';
      el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:20px';
      el.innerHTML = '<div style="background:#16213e;border:2px solid #e74c3c;border-radius:12px;padding:24px;max-width:400px;width:100%;color:#ccc;text-align:center">'
        + '<div style="font-size:36px;margin-bottom:8px">&#9888;</div>'
        + '<h3 style="color:#e74c3c;margin-bottom:8px">' + title + '</h3>'
        + '<p style="font-size:13px;margin-bottom:16px">' + desc + '</p>'
        + '<div style="display:flex;gap:10px;justify-content:center">'
        + '<button id="err-send" style="background:#2ecc71;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer">' + sendLabel + '</button>'
        + '<button id="err-dismiss" style="background:transparent;color:#888;border:1px solid #444;border-radius:8px;padding:10px 20px;font-size:14px;cursor:pointer">' + dismissLabel + '</button>'
        + '</div></div>';
      document.body.appendChild(el);
      function _dismissError() {
        el.remove();
        _errorDialogShown = false;
        try { if (typeof returnToWelcome === 'function') returnToWelcome(); } catch(e2) {}
      }
      document.getElementById('err-dismiss').addEventListener('click', _dismissError);
      el.addEventListener('click', function(ev) { if (ev.target === el) _dismissError(); });
      document.getElementById('err-send').addEventListener('click', function() {
        el.remove();
        _errorDialogShown = false;
        // Submit error report via in-app feedback API (same pipeline, no external browser)
        try {
          var payload = {
            type: 'bug',
            message: '[Auto Error Report]\n' + info,
            version: typeof APP_VERSION_NAME !== 'undefined' ? APP_VERSION_NAME : '?',
            lang: typeof currentLang !== 'undefined' ? currentLang : 'en',
            platform: (typeof _isDemoMode !== 'undefined' && _isDemoMode) ? 'electron-demo' : _isElectron ? 'electron' : /android/i.test(navigator.userAgent) ? 'android' : /iphone|ipad/i.test(navigator.userAgent) ? 'ios' : (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) ? 'pwa' : 'web',
            device: window.innerWidth + 'x' + window.innerHeight,
            origin: location.origin || location.protocol + '//' + location.host
          };
          try { payload.browser_uuid = getBrowserUUID(); } catch(e3) {}
          if (typeof _queueFeedback === 'function') {
            _queueFeedback(payload);
            if (typeof _flushFeedbackQueue === 'function') _flushFeedbackQueue();
          }
          var ack = lang === 'zh' ? '已記錄，感謝回報！' : 'Recorded. Thank you!';
          var toast = document.getElementById('encourage-toast');
          if (toast) { toast.textContent = ack; toast.classList.add('show'); setTimeout(function() { toast.classList.remove('show'); }, 3000); }
        } catch(e2) {}
        try { if (typeof returnToWelcome === 'function') returnToWelcome(); } catch(e3) {}
      });
    } catch(e) {
      console.error('[Octile] Error dialog failed:', e);
    }
  }, 100);
}

// Safe localStorage wrapper — handles QuotaExceeded
var _origSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, value) {
  try {
    _origSetItem(key, value);
  } catch(e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.warn('[Octile] localStorage full, clearing old data');
      // Remove non-critical data to free space
      var expendable = ['octile_messages', 'octile_daily_task_counters', 'octile_multiplier', 'octile_multiplier_daily'];
      for (var i = 0; i < expendable.length; i++) {
        try { localStorage.removeItem(expendable[i]); } catch(e2) {}
      }
      try { _origSetItem(key, value); } catch(e3) {
        console.error('[Octile] localStorage still full after cleanup');
      }
    }
  }
};
// ──────────────────────────────────────────────

const PIECES = [
  { id: 'grey1', color: 'grey', shape: [[1]], auto: true },
  { id: 'grey2', color: 'grey', shape: [[1,1]], auto: true },
  { id: 'grey3', color: 'grey', shape: [[1,1,1]], auto: true },
  { id: 'red1',  color: 'red',  shape: [[1,1,1],[1,1,1]] },
  { id: 'red2',  color: 'red',  shape: [[1,1,1,1]] },
  { id: 'white1',color: 'white',shape: [[1,1,1,1,1]] },
  { id: 'white2',color: 'white',shape: [[1,1],[1,1]] },
  { id: 'blue1', color: 'blue', shape: [[1,1,1,1,1],[1,1,1,1,1]] },
  { id: 'blue2', color: 'blue', shape: [[1,1,1,1],[1,1,1,1],[1,1,1,1]] },
  { id: 'yel1',  color: 'yellow',shape: [[1,1,1],[1,1,1],[1,1,1]] },
  { id: 'yel2',  color: 'yellow',shape: [[1,1,1,1],[1,1,1,1]] },
];

!function(i){"use strict";var v=function(r){var t,n=new Float64Array(16);if(r)for(t=0;t<r.length;t++)n[t]=r[t];return n},h=function(){throw new Error("no PRNG")},o=new Uint8Array(16),n=new Uint8Array(32);n[0]=9;var s=v(),u=v([1]),p=v([56129,1]),c=v([30883,4953,19914,30187,55467,16705,2637,112,59544,30585,16505,36039,65139,11119,27886,20995]),y=v([61785,9906,39828,60374,45398,33411,5274,224,53552,61171,33010,6542,64743,22239,55772,9222]),e=v([54554,36645,11616,51542,42930,38181,51040,26924,56412,64982,57905,49316,21502,52590,14035,8553]),a=v([26200,26214,26214,26214,26214,26214,26214,26214,26214,26214,26214,26214,26214,26214,26214,26214]),l=v([41136,18958,6951,50414,58488,44335,6150,12099,55207,15867,153,11085,57099,20417,9344,11139]);function f(r,t,n,e){r[t]=n>>24&255,r[t+1]=n>>16&255,r[t+2]=n>>8&255,r[t+3]=255&n,r[t+4]=e>>24&255,r[t+5]=e>>16&255,r[t+6]=e>>8&255,r[t+7]=255&e}function w(r,t,n,e,o){var i,h=0;for(i=0;i<o;i++)h|=r[t+i]^n[e+i];return(1&h-1>>>8)-1}function b(r,t,n,e){return w(r,t,n,e,16)}function g(r,t,n,e){return w(r,t,n,e,32)}function A(r,t,n,e){!function(r,t,n,e){for(var o,i=255&e[0]|(255&e[1])<<8|(255&e[2])<<16|(255&e[3])<<24,h=255&n[0]|(255&n[1])<<8|(255&n[2])<<16|(255&n[3])<<24,a=255&n[4]|(255&n[5])<<8|(255&n[6])<<16|(255&n[7])<<24,f=255&n[8]|(255&n[9])<<8|(255&n[10])<<16|(255&n[11])<<24,s=255&n[12]|(255&n[13])<<8|(255&n[14])<<16|(255&n[15])<<24,u=255&e[4]|(255&e[5])<<8|(255&e[6])<<16|(255&e[7])<<24,c=255&t[0]|(255&t[1])<<8|(255&t[2])<<16|(255&t[3])<<24,y=255&t[4]|(255&t[5])<<8|(255&t[6])<<16|(255&t[7])<<24,l=255&t[8]|(255&t[9])<<8|(255&t[10])<<16|(255&t[11])<<24,w=255&t[12]|(255&t[13])<<8|(255&t[14])<<16|(255&t[15])<<24,v=255&e[8]|(255&e[9])<<8|(255&e[10])<<16|(255&e[11])<<24,p=255&n[16]|(255&n[17])<<8|(255&n[18])<<16|(255&n[19])<<24,b=255&n[20]|(255&n[21])<<8|(255&n[22])<<16|(255&n[23])<<24,g=255&n[24]|(255&n[25])<<8|(255&n[26])<<16|(255&n[27])<<24,A=255&n[28]|(255&n[29])<<8|(255&n[30])<<16|(255&n[31])<<24,_=255&e[12]|(255&e[13])<<8|(255&e[14])<<16|(255&e[15])<<24,U=i,d=h,E=a,x=f,M=s,m=u,B=c,S=y,k=l,K=w,Y=v,L=p,T=b,z=g,R=A,P=_,N=0;N<20;N+=2)U^=(o=(T^=(o=(k^=(o=(M^=(o=U+T|0)<<7|o>>>25)+U|0)<<9|o>>>23)+M|0)<<13|o>>>19)+k|0)<<18|o>>>14,m^=(o=(d^=(o=(z^=(o=(K^=(o=m+d|0)<<7|o>>>25)+m|0)<<9|o>>>23)+K|0)<<13|o>>>19)+z|0)<<18|o>>>14,Y^=(o=(B^=(o=(E^=(o=(R^=(o=Y+B|0)<<7|o>>>25)+Y|0)<<9|o>>>23)+R|0)<<13|o>>>19)+E|0)<<18|o>>>14,P^=(o=(L^=(o=(S^=(o=(x^=(o=P+L|0)<<7|o>>>25)+P|0)<<9|o>>>23)+x|0)<<13|o>>>19)+S|0)<<18|o>>>14,U^=(o=(x^=(o=(E^=(o=(d^=(o=U+x|0)<<7|o>>>25)+U|0)<<9|o>>>23)+d|0)<<13|o>>>19)+E|0)<<18|o>>>14,m^=(o=(M^=(o=(S^=(o=(B^=(o=m+M|0)<<7|o>>>25)+m|0)<<9|o>>>23)+B|0)<<13|o>>>19)+S|0)<<18|o>>>14,Y^=(o=(K^=(o=(k^=(o=(L^=(o=Y+K|0)<<7|o>>>25)+Y|0)<<9|o>>>23)+L|0)<<13|o>>>19)+k|0)<<18|o>>>14,P^=(o=(R^=(o=(z^=(o=(T^=(o=P+R|0)<<7|o>>>25)+P|0)<<9|o>>>23)+T|0)<<13|o>>>19)+z|0)<<18|o>>>14;U=U+i|0,d=d+h|0,E=E+a|0,x=x+f|0,M=M+s|0,m=m+u|0,B=B+c|0,S=S+y|0,k=k+l|0,K=K+w|0,Y=Y+v|0,L=L+p|0,T=T+b|0,z=z+g|0,R=R+A|0,P=P+_|0,r[0]=U>>>0&255,r[1]=U>>>8&255,r[2]=U>>>16&255,r[3]=U>>>24&255,r[4]=d>>>0&255,r[5]=d>>>8&255,r[6]=d>>>16&255,r[7]=d>>>24&255,r[8]=E>>>0&255,r[9]=E>>>8&255,r[10]=E>>>16&255,r[11]=E>>>24&255,r[12]=x>>>0&255,r[13]=x>>>8&255,r[14]=x>>>16&255,r[15]=x>>>24&255,r[16]=M>>>0&255,r[17]=M>>>8&255,r[18]=M>>>16&255,r[19]=M>>>24&255,r[20]=m>>>0&255,r[21]=m>>>8&255,r[22]=m>>>16&255,r[23]=m>>>24&255,r[24]=B>>>0&255,r[25]=B>>>8&255,r[26]=B>>>16&255,r[27]=B>>>24&255,r[28]=S>>>0&255,r[29]=S>>>8&255,r[30]=S>>>16&255,r[31]=S>>>24&255,r[32]=k>>>0&255,r[33]=k>>>8&255,r[34]=k>>>16&255,r[35]=k>>>24&255,r[36]=K>>>0&255,r[37]=K>>>8&255,r[38]=K>>>16&255,r[39]=K>>>24&255,r[40]=Y>>>0&255,r[41]=Y>>>8&255,r[42]=Y>>>16&255,r[43]=Y>>>24&255,r[44]=L>>>0&255,r[45]=L>>>8&255,r[46]=L>>>16&255,r[47]=L>>>24&255,r[48]=T>>>0&255,r[49]=T>>>8&255,r[50]=T>>>16&255,r[51]=T>>>24&255,r[52]=z>>>0&255,r[53]=z>>>8&255,r[54]=z>>>16&255,r[55]=z>>>24&255,r[56]=R>>>0&255,r[57]=R>>>8&255,r[58]=R>>>16&255,r[59]=R>>>24&255,r[60]=P>>>0&255,r[61]=P>>>8&255,r[62]=P>>>16&255,r[63]=P>>>24&255}(r,t,n,e)}function _(r,t,n,e){!function(r,t,n,e){for(var o,i=255&e[0]|(255&e[1])<<8|(255&e[2])<<16|(255&e[3])<<24,h=255&n[0]|(255&n[1])<<8|(255&n[2])<<16|(255&n[3])<<24,a=255&n[4]|(255&n[5])<<8|(255&n[6])<<16|(255&n[7])<<24,f=255&n[8]|(255&n[9])<<8|(255&n[10])<<16|(255&n[11])<<24,s=255&n[12]|(255&n[13])<<8|(255&n[14])<<16|(255&n[15])<<24,u=255&e[4]|(255&e[5])<<8|(255&e[6])<<16|(255&e[7])<<24,c=255&t[0]|(255&t[1])<<8|(255&t[2])<<16|(255&t[3])<<24,y=255&t[4]|(255&t[5])<<8|(255&t[6])<<16|(255&t[7])<<24,l=255&t[8]|(255&t[9])<<8|(255&t[10])<<16|(255&t[11])<<24,w=255&t[12]|(255&t[13])<<8|(255&t[14])<<16|(255&t[15])<<24,v=255&e[8]|(255&e[9])<<8|(255&e[10])<<16|(255&e[11])<<24,p=255&n[16]|(255&n[17])<<8|(255&n[18])<<16|(255&n[19])<<24,b=255&n[20]|(255&n[21])<<8|(255&n[22])<<16|(255&n[23])<<24,g=255&n[24]|(255&n[25])<<8|(255&n[26])<<16|(255&n[27])<<24,A=255&n[28]|(255&n[29])<<8|(255&n[30])<<16|(255&n[31])<<24,_=255&e[12]|(255&e[13])<<8|(255&e[14])<<16|(255&e[15])<<24,U=0;U<20;U+=2)i^=(o=(b^=(o=(l^=(o=(s^=(o=i+b|0)<<7|o>>>25)+i|0)<<9|o>>>23)+s|0)<<13|o>>>19)+l|0)<<18|o>>>14,u^=(o=(h^=(o=(g^=(o=(w^=(o=u+h|0)<<7|o>>>25)+u|0)<<9|o>>>23)+w|0)<<13|o>>>19)+g|0)<<18|o>>>14,v^=(o=(c^=(o=(a^=(o=(A^=(o=v+c|0)<<7|o>>>25)+v|0)<<9|o>>>23)+A|0)<<13|o>>>19)+a|0)<<18|o>>>14,_^=(o=(p^=(o=(y^=(o=(f^=(o=_+p|0)<<7|o>>>25)+_|0)<<9|o>>>23)+f|0)<<13|o>>>19)+y|0)<<18|o>>>14,i^=(o=(f^=(o=(a^=(o=(h^=(o=i+f|0)<<7|o>>>25)+i|0)<<9|o>>>23)+h|0)<<13|o>>>19)+a|0)<<18|o>>>14,u^=(o=(s^=(o=(y^=(o=(c^=(o=u+s|0)<<7|o>>>25)+u|0)<<9|o>>>23)+c|0)<<13|o>>>19)+y|0)<<18|o>>>14,v^=(o=(w^=(o=(l^=(o=(p^=(o=v+w|0)<<7|o>>>25)+v|0)<<9|o>>>23)+p|0)<<13|o>>>19)+l|0)<<18|o>>>14,_^=(o=(A^=(o=(g^=(o=(b^=(o=_+A|0)<<7|o>>>25)+_|0)<<9|o>>>23)+b|0)<<13|o>>>19)+g|0)<<18|o>>>14;r[0]=i>>>0&255,r[1]=i>>>8&255,r[2]=i>>>16&255,r[3]=i>>>24&255,r[4]=u>>>0&255,r[5]=u>>>8&255,r[6]=u>>>16&255,r[7]=u>>>24&255,r[8]=v>>>0&255,r[9]=v>>>8&255,r[10]=v>>>16&255,r[11]=v>>>24&255,r[12]=_>>>0&255,r[13]=_>>>8&255,r[14]=_>>>16&255,r[15]=_>>>24&255,r[16]=c>>>0&255,r[17]=c>>>8&255,r[18]=c>>>16&255,r[19]=c>>>24&255,r[20]=y>>>0&255,r[21]=y>>>8&255,r[22]=y>>>16&255,r[23]=y>>>24&255,r[24]=l>>>0&255,r[25]=l>>>8&255,r[26]=l>>>16&255,r[27]=l>>>24&255,r[28]=w>>>0&255,r[29]=w>>>8&255,r[30]=w>>>16&255,r[31]=w>>>24&255}(r,t,n,e)}var U=new Uint8Array([101,120,112,97,110,100,32,51,50,45,98,121,116,101,32,107]);function d(r,t,n,e,o,i,h){var a,f,s=new Uint8Array(16),u=new Uint8Array(64);for(f=0;f<16;f++)s[f]=0;for(f=0;f<8;f++)s[f]=i[f];for(;64<=o;){for(A(u,s,h,U),f=0;f<64;f++)r[t+f]=n[e+f]^u[f];for(a=1,f=8;f<16;f++)a=a+(255&s[f])|0,s[f]=255&a,a>>>=8;o-=64,t+=64,e+=64}if(0<o)for(A(u,s,h,U),f=0;f<o;f++)r[t+f]=n[e+f]^u[f];return 0}function E(r,t,n,e,o){var i,h,a=new Uint8Array(16),f=new Uint8Array(64);for(h=0;h<16;h++)a[h]=0;for(h=0;h<8;h++)a[h]=e[h];for(;64<=n;){for(A(f,a,o,U),h=0;h<64;h++)r[t+h]=f[h];for(i=1,h=8;h<16;h++)i=i+(255&a[h])|0,a[h]=255&i,i>>>=8;n-=64,t+=64}if(0<n)for(A(f,a,o,U),h=0;h<n;h++)r[t+h]=f[h];return 0}function x(r,t,n,e,o){var i=new Uint8Array(32);_(i,e,o,U);for(var h=new Uint8Array(8),a=0;a<8;a++)h[a]=e[a+16];return E(r,t,n,h,i)}function M(r,t,n,e,o,i,h){var a=new Uint8Array(32);_(a,i,h,U);for(var f=new Uint8Array(8),s=0;s<8;s++)f[s]=i[s+16];return d(r,t,n,e,o,f,a)}var m=function(r){var t,n,e,o,i,h,a,f;this.buffer=new Uint8Array(16),this.r=new Uint16Array(10),this.h=new Uint16Array(10),this.pad=new Uint16Array(8),this.leftover=0,t=255&r[this.fin=0]|(255&r[1])<<8,this.r[0]=8191&t,n=255&r[2]|(255&r[3])<<8,this.r[1]=8191&(t>>>13|n<<3),e=255&r[4]|(255&r[5])<<8,this.r[2]=7939&(n>>>10|e<<6),o=255&r[6]|(255&r[7])<<8,this.r[3]=8191&(e>>>7|o<<9),i=255&r[8]|(255&r[9])<<8,this.r[4]=255&(o>>>4|i<<12),this.r[5]=i>>>1&8190,h=255&r[10]|(255&r[11])<<8,this.r[6]=8191&(i>>>14|h<<2),a=255&r[12]|(255&r[13])<<8,this.r[7]=8065&(h>>>11|a<<5),f=255&r[14]|(255&r[15])<<8,this.r[8]=8191&(a>>>8|f<<8),this.r[9]=f>>>5&127,this.pad[0]=255&r[16]|(255&r[17])<<8,this.pad[1]=255&r[18]|(255&r[19])<<8,this.pad[2]=255&r[20]|(255&r[21])<<8,this.pad[3]=255&r[22]|(255&r[23])<<8,this.pad[4]=255&r[24]|(255&r[25])<<8,this.pad[5]=255&r[26]|(255&r[27])<<8,this.pad[6]=255&r[28]|(255&r[29])<<8,this.pad[7]=255&r[30]|(255&r[31])<<8};function B(r,t,n,e,o,i){var h=new m(i);return h.update(n,e,o),h.finish(r,t),0}function S(r,t,n,e,o,i){var h=new Uint8Array(16);return B(h,0,n,e,o,i),b(r,t,h,0)}function k(r,t,n,e,o){var i;if(n<32)return-1;for(M(r,0,t,0,n,e,o),B(r,16,r,32,n-32,r),i=0;i<16;i++)r[i]=0;return 0}function K(r,t,n,e,o){var i,h=new Uint8Array(32);if(n<32)return-1;if(x(h,0,32,e,o),0!==S(t,16,t,32,n-32,h))return-1;for(M(r,0,t,0,n,e,o),i=0;i<32;i++)r[i]=0;return 0}function Y(r,t){var n;for(n=0;n<16;n++)r[n]=0|t[n]}function L(r){var t,n,e=1;for(t=0;t<16;t++)n=r[t]+e+65535,e=Math.floor(n/65536),r[t]=n-65536*e;r[0]+=e-1+37*(e-1)}function T(r,t,n){for(var e,o=~(n-1),i=0;i<16;i++)e=o&(r[i]^t[i]),r[i]^=e,t[i]^=e}function z(r,t){var n,e,o,i=v(),h=v();for(n=0;n<16;n++)h[n]=t[n];for(L(h),L(h),L(h),e=0;e<2;e++){for(i[0]=h[0]-65517,n=1;n<15;n++)i[n]=h[n]-65535-(i[n-1]>>16&1),i[n-1]&=65535;i[15]=h[15]-32767-(i[14]>>16&1),o=i[15]>>16&1,i[14]&=65535,T(h,i,1-o)}for(n=0;n<16;n++)r[2*n]=255&h[n],r[2*n+1]=h[n]>>8}function R(r,t){var n=new Uint8Array(32),e=new Uint8Array(32);return z(n,r),z(e,t),g(n,0,e,0)}function P(r){var t=new Uint8Array(32);return z(t,r),1&t[0]}function N(r,t){var n;for(n=0;n<16;n++)r[n]=t[2*n]+(t[2*n+1]<<8);r[15]&=32767}function O(r,t,n){for(var e=0;e<16;e++)r[e]=t[e]+n[e]}function C(r,t,n){for(var e=0;e<16;e++)r[e]=t[e]-n[e]}function F(r,t,n){var e,o,i=0,h=0,a=0,f=0,s=0,u=0,c=0,y=0,l=0,w=0,v=0,p=0,b=0,g=0,A=0,_=0,U=0,d=0,E=0,x=0,M=0,m=0,B=0,S=0,k=0,K=0,Y=0,L=0,T=0,z=0,R=0,P=n[0],N=n[1],O=n[2],C=n[3],F=n[4],I=n[5],Z=n[6],G=n[7],q=n[8],D=n[9],V=n[10],X=n[11],j=n[12],H=n[13],J=n[14],Q=n[15];i+=(e=t[0])*P,h+=e*N,a+=e*O,f+=e*C,s+=e*F,u+=e*I,c+=e*Z,y+=e*G,l+=e*q,w+=e*D,v+=e*V,p+=e*X,b+=e*j,g+=e*H,A+=e*J,_+=e*Q,h+=(e=t[1])*P,a+=e*N,f+=e*O,s+=e*C,u+=e*F,c+=e*I,y+=e*Z,l+=e*G,w+=e*q,v+=e*D,p+=e*V,b+=e*X,g+=e*j,A+=e*H,_+=e*J,U+=e*Q,a+=(e=t[2])*P,f+=e*N,s+=e*O,u+=e*C,c+=e*F,y+=e*I,l+=e*Z,w+=e*G,v+=e*q,p+=e*D,b+=e*V,g+=e*X,A+=e*j,_+=e*H,U+=e*J,d+=e*Q,f+=(e=t[3])*P,s+=e*N,u+=e*O,c+=e*C,y+=e*F,l+=e*I,w+=e*Z,v+=e*G,p+=e*q,b+=e*D,g+=e*V,A+=e*X,_+=e*j,U+=e*H,d+=e*J,E+=e*Q,s+=(e=t[4])*P,u+=e*N,c+=e*O,y+=e*C,l+=e*F,w+=e*I,v+=e*Z,p+=e*G,b+=e*q,g+=e*D,A+=e*V,_+=e*X,U+=e*j,d+=e*H,E+=e*J,x+=e*Q,u+=(e=t[5])*P,c+=e*N,y+=e*O,l+=e*C,w+=e*F,v+=e*I,p+=e*Z,b+=e*G,g+=e*q,A+=e*D,_+=e*V,U+=e*X,d+=e*j,E+=e*H,x+=e*J,M+=e*Q,c+=(e=t[6])*P,y+=e*N,l+=e*O,w+=e*C,v+=e*F,p+=e*I,b+=e*Z,g+=e*G,A+=e*q,_+=e*D,U+=e*V,d+=e*X,E+=e*j,x+=e*H,M+=e*J,m+=e*Q,y+=(e=t[7])*P,l+=e*N,w+=e*O,v+=e*C,p+=e*F,b+=e*I,g+=e*Z,A+=e*G,_+=e*q,U+=e*D,d+=e*V,E+=e*X,x+=e*j,M+=e*H,m+=e*J,B+=e*Q,l+=(e=t[8])*P,w+=e*N,v+=e*O,p+=e*C,b+=e*F,g+=e*I,A+=e*Z,_+=e*G,U+=e*q,d+=e*D,E+=e*V,x+=e*X,M+=e*j,m+=e*H,B+=e*J,S+=e*Q,w+=(e=t[9])*P,v+=e*N,p+=e*O,b+=e*C,g+=e*F,A+=e*I,_+=e*Z,U+=e*G,d+=e*q,E+=e*D,x+=e*V,M+=e*X,m+=e*j,B+=e*H,S+=e*J,k+=e*Q,v+=(e=t[10])*P,p+=e*N,b+=e*O,g+=e*C,A+=e*F,_+=e*I,U+=e*Z,d+=e*G,E+=e*q,x+=e*D,M+=e*V,m+=e*X,B+=e*j,S+=e*H,k+=e*J,K+=e*Q,p+=(e=t[11])*P,b+=e*N,g+=e*O,A+=e*C,_+=e*F,U+=e*I,d+=e*Z,E+=e*G,x+=e*q,M+=e*D,m+=e*V,B+=e*X,S+=e*j,k+=e*H,K+=e*J,Y+=e*Q,b+=(e=t[12])*P,g+=e*N,A+=e*O,_+=e*C,U+=e*F,d+=e*I,E+=e*Z,x+=e*G,M+=e*q,m+=e*D,B+=e*V,S+=e*X,k+=e*j,K+=e*H,Y+=e*J,L+=e*Q,g+=(e=t[13])*P,A+=e*N,_+=e*O,U+=e*C,d+=e*F,E+=e*I,x+=e*Z,M+=e*G,m+=e*q,B+=e*D,S+=e*V,k+=e*X,K+=e*j,Y+=e*H,L+=e*J,T+=e*Q,A+=(e=t[14])*P,_+=e*N,U+=e*O,d+=e*C,E+=e*F,x+=e*I,M+=e*Z,m+=e*G,B+=e*q,S+=e*D,k+=e*V,K+=e*X,Y+=e*j,L+=e*H,T+=e*J,z+=e*Q,_+=(e=t[15])*P,h+=38*(d+=e*O),a+=38*(E+=e*C),f+=38*(x+=e*F),s+=38*(M+=e*I),u+=38*(m+=e*Z),c+=38*(B+=e*G),y+=38*(S+=e*q),l+=38*(k+=e*D),w+=38*(K+=e*V),v+=38*(Y+=e*X),p+=38*(L+=e*j),b+=38*(T+=e*H),g+=38*(z+=e*J),A+=38*(R+=e*Q),i=(e=(i+=38*(U+=e*N))+(o=1)+65535)-65536*(o=Math.floor(e/65536)),h=(e=h+o+65535)-65536*(o=Math.floor(e/65536)),a=(e=a+o+65535)-65536*(o=Math.floor(e/65536)),f=(e=f+o+65535)-65536*(o=Math.floor(e/65536)),s=(e=s+o+65535)-65536*(o=Math.floor(e/65536)),u=(e=u+o+65535)-65536*(o=Math.floor(e/65536)),c=(e=c+o+65535)-65536*(o=Math.floor(e/65536)),y=(e=y+o+65535)-65536*(o=Math.floor(e/65536)),l=(e=l+o+65535)-65536*(o=Math.floor(e/65536)),w=(e=w+o+65535)-65536*(o=Math.floor(e/65536)),v=(e=v+o+65535)-65536*(o=Math.floor(e/65536)),p=(e=p+o+65535)-65536*(o=Math.floor(e/65536)),b=(e=b+o+65535)-65536*(o=Math.floor(e/65536)),g=(e=g+o+65535)-65536*(o=Math.floor(e/65536)),A=(e=A+o+65535)-65536*(o=Math.floor(e/65536)),_=(e=_+o+65535)-65536*(o=Math.floor(e/65536)),i=(e=(i+=o-1+37*(o-1))+(o=1)+65535)-65536*(o=Math.floor(e/65536)),h=(e=h+o+65535)-65536*(o=Math.floor(e/65536)),a=(e=a+o+65535)-65536*(o=Math.floor(e/65536)),f=(e=f+o+65535)-65536*(o=Math.floor(e/65536)),s=(e=s+o+65535)-65536*(o=Math.floor(e/65536)),u=(e=u+o+65535)-65536*(o=Math.floor(e/65536)),c=(e=c+o+65535)-65536*(o=Math.floor(e/65536)),y=(e=y+o+65535)-65536*(o=Math.floor(e/65536)),l=(e=l+o+65535)-65536*(o=Math.floor(e/65536)),w=(e=w+o+65535)-65536*(o=Math.floor(e/65536)),v=(e=v+o+65535)-65536*(o=Math.floor(e/65536)),p=(e=p+o+65535)-65536*(o=Math.floor(e/65536)),b=(e=b+o+65535)-65536*(o=Math.floor(e/65536)),g=(e=g+o+65535)-65536*(o=Math.floor(e/65536)),A=(e=A+o+65535)-65536*(o=Math.floor(e/65536)),_=(e=_+o+65535)-65536*(o=Math.floor(e/65536)),i+=o-1+37*(o-1),r[0]=i,r[1]=h,r[2]=a,r[3]=f,r[4]=s,r[5]=u,r[6]=c,r[7]=y,r[8]=l,r[9]=w,r[10]=v,r[11]=p,r[12]=b,r[13]=g,r[14]=A,r[15]=_}function I(r,t){F(r,t,t)}function Z(r,t){var n,e=v();for(n=0;n<16;n++)e[n]=t[n];for(n=253;0<=n;n--)I(e,e),2!==n&&4!==n&&F(e,e,t);for(n=0;n<16;n++)r[n]=e[n]}function G(r,t){var n,e=v();for(n=0;n<16;n++)e[n]=t[n];for(n=250;0<=n;n--)I(e,e),1!==n&&F(e,e,t);for(n=0;n<16;n++)r[n]=e[n]}function q(r,t,n){var e,o,i=new Uint8Array(32),h=new Float64Array(80),a=v(),f=v(),s=v(),u=v(),c=v(),y=v();for(o=0;o<31;o++)i[o]=t[o];for(i[31]=127&t[31]|64,i[0]&=248,N(h,n),o=0;o<16;o++)f[o]=h[o],u[o]=a[o]=s[o]=0;for(a[0]=u[0]=1,o=254;0<=o;--o)T(a,f,e=i[o>>>3]>>>(7&o)&1),T(s,u,e),O(c,a,s),C(a,a,s),O(s,f,u),C(f,f,u),I(u,c),I(y,a),F(a,s,a),F(s,f,c),O(c,a,s),C(a,a,s),I(f,a),C(s,u,y),F(a,s,p),O(a,a,u),F(s,s,a),F(a,u,y),F(u,f,h),I(f,c),T(a,f,e),T(s,u,e);for(o=0;o<16;o++)h[o+16]=a[o],h[o+32]=s[o],h[o+48]=f[o],h[o+64]=u[o];var l=h.subarray(32),w=h.subarray(16);return Z(l,l),F(w,w,l),z(r,w),0}function D(r,t){return q(r,t,n)}function V(r,t){return h(t,32),D(r,t)}function X(r,t,n){var e=new Uint8Array(32);return q(e,n,t),_(r,o,e,U)}m.prototype.blocks=function(r,t,n){for(var e,o,i,h,a,f,s,u,c,y,l,w,v,p,b,g,A,_,U,d=this.fin?0:2048,E=this.h[0],x=this.h[1],M=this.h[2],m=this.h[3],B=this.h[4],S=this.h[5],k=this.h[6],K=this.h[7],Y=this.h[8],L=this.h[9],T=this.r[0],z=this.r[1],R=this.r[2],P=this.r[3],N=this.r[4],O=this.r[5],C=this.r[6],F=this.r[7],I=this.r[8],Z=this.r[9];16<=n;)y=c=0,y+=(E+=8191&(e=255&r[t+0]|(255&r[t+1])<<8))*T,y+=(x+=8191&(e>>>13|(o=255&r[t+2]|(255&r[t+3])<<8)<<3))*(5*Z),y+=(M+=8191&(o>>>10|(i=255&r[t+4]|(255&r[t+5])<<8)<<6))*(5*I),y+=(m+=8191&(i>>>7|(h=255&r[t+6]|(255&r[t+7])<<8)<<9))*(5*F),c=(y+=(B+=8191&(h>>>4|(a=255&r[t+8]|(255&r[t+9])<<8)<<12))*(5*C))>>>13,y&=8191,y+=(S+=a>>>1&8191)*(5*O),y+=(k+=8191&(a>>>14|(f=255&r[t+10]|(255&r[t+11])<<8)<<2))*(5*N),y+=(K+=8191&(f>>>11|(s=255&r[t+12]|(255&r[t+13])<<8)<<5))*(5*P),y+=(Y+=8191&(s>>>8|(u=255&r[t+14]|(255&r[t+15])<<8)<<8))*(5*R),l=c+=(y+=(L+=u>>>5|d)*(5*z))>>>13,l+=E*z,l+=x*T,l+=M*(5*Z),l+=m*(5*I),c=(l+=B*(5*F))>>>13,l&=8191,l+=S*(5*C),l+=k*(5*O),l+=K*(5*N),l+=Y*(5*P),c+=(l+=L*(5*R))>>>13,l&=8191,w=c,w+=E*R,w+=x*z,w+=M*T,w+=m*(5*Z),c=(w+=B*(5*I))>>>13,w&=8191,w+=S*(5*F),w+=k*(5*C),w+=K*(5*O),w+=Y*(5*N),v=c+=(w+=L*(5*P))>>>13,v+=E*P,v+=x*R,v+=M*z,v+=m*T,c=(v+=B*(5*Z))>>>13,v&=8191,v+=S*(5*I),v+=k*(5*F),v+=K*(5*C),v+=Y*(5*O),p=c+=(v+=L*(5*N))>>>13,p+=E*N,p+=x*P,p+=M*R,p+=m*z,c=(p+=B*T)>>>13,p&=8191,p+=S*(5*Z),p+=k*(5*I),p+=K*(5*F),p+=Y*(5*C),b=c+=(p+=L*(5*O))>>>13,b+=E*O,b+=x*N,b+=M*P,b+=m*R,c=(b+=B*z)>>>13,b&=8191,b+=S*T,b+=k*(5*Z),b+=K*(5*I),b+=Y*(5*F),g=c+=(b+=L*(5*C))>>>13,g+=E*C,g+=x*O,g+=M*N,g+=m*P,c=(g+=B*R)>>>13,g&=8191,g+=S*z,g+=k*T,g+=K*(5*Z),g+=Y*(5*I),A=c+=(g+=L*(5*F))>>>13,A+=E*F,A+=x*C,A+=M*O,A+=m*N,c=(A+=B*P)>>>13,A&=8191,A+=S*R,A+=k*z,A+=K*T,A+=Y*(5*Z),_=c+=(A+=L*(5*I))>>>13,_+=E*I,_+=x*F,_+=M*C,_+=m*O,c=(_+=B*N)>>>13,_&=8191,_+=S*P,_+=k*R,_+=K*z,_+=Y*T,U=c+=(_+=L*(5*Z))>>>13,U+=E*Z,U+=x*I,U+=M*F,U+=m*C,c=(U+=B*O)>>>13,U&=8191,U+=S*N,U+=k*P,U+=K*R,U+=Y*z,E=y=8191&(c=(c=((c+=(U+=L*T)>>>13)<<2)+c|0)+(y&=8191)|0),x=l+=c>>>=13,M=w&=8191,m=v&=8191,B=p&=8191,S=b&=8191,k=g&=8191,K=A&=8191,Y=_&=8191,L=U&=8191,t+=16,n-=16;this.h[0]=E,this.h[1]=x,this.h[2]=M,this.h[3]=m,this.h[4]=B,this.h[5]=S,this.h[6]=k,this.h[7]=K,this.h[8]=Y,this.h[9]=L},m.prototype.finish=function(r,t){var n,e,o,i,h=new Uint16Array(10);if(this.leftover){for(i=this.leftover,this.buffer[i++]=1;i<16;i++)this.buffer[i]=0;this.fin=1,this.blocks(this.buffer,0,16)}for(n=this.h[1]>>>13,this.h[1]&=8191,i=2;i<10;i++)this.h[i]+=n,n=this.h[i]>>>13,this.h[i]&=8191;for(this.h[0]+=5*n,n=this.h[0]>>>13,this.h[0]&=8191,this.h[1]+=n,n=this.h[1]>>>13,this.h[1]&=8191,this.h[2]+=n,h[0]=this.h[0]+5,n=h[0]>>>13,h[0]&=8191,i=1;i<10;i++)h[i]=this.h[i]+n,n=h[i]>>>13,h[i]&=8191;for(h[9]-=8192,e=(1^n)-1,i=0;i<10;i++)h[i]&=e;for(e=~e,i=0;i<10;i++)this.h[i]=this.h[i]&e|h[i];for(this.h[0]=65535&(this.h[0]|this.h[1]<<13),this.h[1]=65535&(this.h[1]>>>3|this.h[2]<<10),this.h[2]=65535&(this.h[2]>>>6|this.h[3]<<7),this.h[3]=65535&(this.h[3]>>>9|this.h[4]<<4),this.h[4]=65535&(this.h[4]>>>12|this.h[5]<<1|this.h[6]<<14),this.h[5]=65535&(this.h[6]>>>2|this.h[7]<<11),this.h[6]=65535&(this.h[7]>>>5|this.h[8]<<8),this.h[7]=65535&(this.h[8]>>>8|this.h[9]<<5),o=this.h[0]+this.pad[0],this.h[0]=65535&o,i=1;i<8;i++)o=(this.h[i]+this.pad[i]|0)+(o>>>16)|0,this.h[i]=65535&o;r[t+0]=this.h[0]>>>0&255,r[t+1]=this.h[0]>>>8&255,r[t+2]=this.h[1]>>>0&255,r[t+3]=this.h[1]>>>8&255,r[t+4]=this.h[2]>>>0&255,r[t+5]=this.h[2]>>>8&255,r[t+6]=this.h[3]>>>0&255,r[t+7]=this.h[3]>>>8&255,r[t+8]=this.h[4]>>>0&255,r[t+9]=this.h[4]>>>8&255,r[t+10]=this.h[5]>>>0&255,r[t+11]=this.h[5]>>>8&255,r[t+12]=this.h[6]>>>0&255,r[t+13]=this.h[6]>>>8&255,r[t+14]=this.h[7]>>>0&255,r[t+15]=this.h[7]>>>8&255},m.prototype.update=function(r,t,n){var e,o;if(this.leftover){for(n<(o=16-this.leftover)&&(o=n),e=0;e<o;e++)this.buffer[this.leftover+e]=r[t+e];if(n-=o,t+=o,this.leftover+=o,this.leftover<16)return;this.blocks(this.buffer,0,16),this.leftover=0}if(16<=n&&(o=n-n%16,this.blocks(r,t,o),t+=o,n-=o),n){for(e=0;e<n;e++)this.buffer[this.leftover+e]=r[t+e];this.leftover+=n}};var j=k,H=K;var J=[1116352408,3609767458,1899447441,602891725,3049323471,3964484399,3921009573,2173295548,961987163,4081628472,1508970993,3053834265,2453635748,2937671579,2870763221,3664609560,3624381080,2734883394,310598401,1164996542,607225278,1323610764,1426881987,3590304994,1925078388,4068182383,2162078206,991336113,2614888103,633803317,3248222580,3479774868,3835390401,2666613458,4022224774,944711139,264347078,2341262773,604807628,2007800933,770255983,1495990901,1249150122,1856431235,1555081692,3175218132,1996064986,2198950837,2554220882,3999719339,2821834349,766784016,2952996808,2566594879,3210313671,3203337956,3336571891,1034457026,3584528711,2466948901,113926993,3758326383,338241895,168717936,666307205,1188179964,773529912,1546045734,1294757372,1522805485,1396182291,2643833823,1695183700,2343527390,1986661051,1014477480,2177026350,1206759142,2456956037,344077627,2730485921,1290863460,2820302411,3158454273,3259730800,3505952657,3345764771,106217008,3516065817,3606008344,3600352804,1432725776,4094571909,1467031594,275423344,851169720,430227734,3100823752,506948616,1363258195,659060556,3750685593,883997877,3785050280,958139571,3318307427,1322822218,3812723403,1537002063,2003034995,1747873779,3602036899,1955562222,1575990012,2024104815,1125592928,2227730452,2716904306,2361852424,442776044,2428436474,593698344,2756734187,3733110249,3204031479,2999351573,3329325298,3815920427,3391569614,3928383900,3515267271,566280711,3940187606,3454069534,4118630271,4000239992,116418474,1914138554,174292421,2731055270,289380356,3203993006,460393269,320620315,685471733,587496836,852142971,1086792851,1017036298,365543100,1126000580,2618297676,1288033470,3409855158,1501505948,4234509866,1607167915,987167468,1816402316,1246189591];function Q(r,t,n,e){for(var o,i,h,a,f,s,u,c,y,l,w,v,p,b,g,A,_,U,d,E,x,M,m,B,S=new Int32Array(16),k=new Int32Array(16),K=r[0],Y=r[1],L=r[2],T=r[3],z=r[4],R=r[5],P=r[6],N=r[7],O=t[0],C=t[1],F=t[2],I=t[3],Z=t[4],G=t[5],q=t[6],D=t[7],V=0;128<=e;){for(_=0;_<16;_++)U=8*_+V,S[_]=n[U+0]<<24|n[U+1]<<16|n[U+2]<<8|n[U+3],k[_]=n[U+4]<<24|n[U+5]<<16|n[U+6]<<8|n[U+7];for(_=0;_<80;_++)if(o=Y,i=L,h=T,c=C,y=F,l=I,x=65535&(E=D),M=E>>>16,m=65535&(d=N),B=d>>>16,x+=65535&(E=((w=Z)>>>14|(a=z)<<18)^(Z>>>18|z<<14)^(z>>>9|Z<<23)),M+=E>>>16,m+=65535&(d=(z>>>14|Z<<18)^(z>>>18|Z<<14)^(Z>>>9|z<<23)),B+=d>>>16,x+=65535&(E=Z&(v=G)^~Z&(p=q)),M+=E>>>16,m+=65535&(d=z&(f=R)^~z&(s=P)),B+=d>>>16,d=J[2*_],x+=65535&(E=J[2*_+1]),M+=E>>>16,m+=65535&d,B+=d>>>16,d=S[_%16],M+=(E=k[_%16])>>>16,m+=65535&d,B+=d>>>16,m+=(M+=(x+=65535&E)>>>16)>>>16,x=65535&(E=A=65535&x|M<<16),M=E>>>16,m=65535&(d=g=65535&m|(B+=m>>>16)<<16),B=d>>>16,x+=65535&(E=(O>>>28|K<<4)^(K>>>2|O<<30)^(K>>>7|O<<25)),M+=E>>>16,m+=65535&(d=(K>>>28|O<<4)^(O>>>2|K<<30)^(O>>>7|K<<25)),B+=d>>>16,M+=(E=O&C^O&F^C&F)>>>16,m+=65535&(d=K&Y^K&L^Y&L),B+=d>>>16,u=65535&(m+=(M+=(x+=65535&E)>>>16)>>>16)|(B+=m>>>16)<<16,b=65535&x|M<<16,x=65535&(E=l),M=E>>>16,m=65535&(d=h),B=d>>>16,M+=(E=A)>>>16,m+=65535&(d=g),B+=d>>>16,Y=K,L=o,T=i,z=h=65535&(m+=(M+=(x+=65535&E)>>>16)>>>16)|(B+=m>>>16)<<16,R=a,P=f,N=s,K=u,C=O,F=c,I=y,Z=l=65535&x|M<<16,G=w,q=v,D=p,O=b,_%16==15)for(U=0;U<16;U++)d=S[U],x=65535&(E=k[U]),M=E>>>16,m=65535&d,B=d>>>16,d=S[(U+9)%16],x+=65535&(E=k[(U+9)%16]),M+=E>>>16,m+=65535&d,B+=d>>>16,g=S[(U+1)%16],x+=65535&(E=((A=k[(U+1)%16])>>>1|g<<31)^(A>>>8|g<<24)^(A>>>7|g<<25)),M+=E>>>16,m+=65535&(d=(g>>>1|A<<31)^(g>>>8|A<<24)^g>>>7),B+=d>>>16,g=S[(U+14)%16],M+=(E=((A=k[(U+14)%16])>>>19|g<<13)^(g>>>29|A<<3)^(A>>>6|g<<26))>>>16,m+=65535&(d=(g>>>19|A<<13)^(A>>>29|g<<3)^g>>>6),B+=d>>>16,B+=(m+=(M+=(x+=65535&E)>>>16)>>>16)>>>16,S[U]=65535&m|B<<16,k[U]=65535&x|M<<16;x=65535&(E=O),M=E>>>16,m=65535&(d=K),B=d>>>16,d=r[0],M+=(E=t[0])>>>16,m+=65535&d,B+=d>>>16,B+=(m+=(M+=(x+=65535&E)>>>16)>>>16)>>>16,r[0]=K=65535&m|B<<16,t[0]=O=65535&x|M<<16,x=65535&(E=C),M=E>>>16,m=65535&(d=Y),B=d>>>16,d=r[1],M+=(E=t[1])>>>16,m+=65535&d,B+=d>>>16,B+=(m+=(M+=(x+=65535&E)>>>16)>>>16)>>>16,r[1]=Y=65535&m|B<<16,t[1]=C=65535&x|M<<16,x=65535&(E=F),M=E>>>16,m=65535&(d=L),B=d>>>16,d=r[2],M+=(E=t[2])>>>16,m+=65535&d,B+=d>>>16,B+=(m+=(M+=(x+=65535&E)>>>16)>>>16)>>>16,r[2]=L=65535&m|B<<16,t[2]=F=65535&x|M<<16,x=65535&(E=I),M=E>>>16,m=65535&(d=T),B=d>>>16,d=r[3],M+=(E=t[3])>>>16,m+=65535&d,B+=d>>>16,B+=(m+=(M+=(x+=65535&E)>>>16)>>>16)>>>16,r[3]=T=65535&m|B<<16,t[3]=I=65535&x|M<<16,x=65535&(E=Z),M=E>>>16,m=65535&(d=z),B=d>>>16,d=r[4],M+=(E=t[4])>>>16,m+=65535&d,B+=d>>>16,B+=(m+=(M+=(x+=65535&E)>>>16)>>>16)>>>16,r[4]=z=65535&m|B<<16,t[4]=Z=65535&x|M<<16,x=65535&(E=G),M=E>>>16,m=65535&(d=R),B=d>>>16,d=r[5],M+=(E=t[5])>>>16,m+=65535&d,B+=d>>>16,B+=(m+=(M+=(x+=65535&E)>>>16)>>>16)>>>16,r[5]=R=65535&m|B<<16,t[5]=G=65535&x|M<<16,x=65535&(E=q),M=E>>>16,m=65535&(d=P),B=d>>>16,d=r[6],M+=(E=t[6])>>>16,m+=65535&d,B+=d>>>16,B+=(m+=(M+=(x+=65535&E)>>>16)>>>16)>>>16,r[6]=P=65535&m|B<<16,t[6]=q=65535&x|M<<16,x=65535&(E=D),M=E>>>16,m=65535&(d=N),B=d>>>16,d=r[7],M+=(E=t[7])>>>16,m+=65535&d,B+=d>>>16,B+=(m+=(M+=(x+=65535&E)>>>16)>>>16)>>>16,r[7]=N=65535&m|B<<16,t[7]=D=65535&x|M<<16,V+=128,e-=128}return e}function W(r,t,n){var e,o=new Int32Array(8),i=new Int32Array(8),h=new Uint8Array(256),a=n;for(o[0]=1779033703,o[1]=3144134277,o[2]=1013904242,o[3]=2773480762,o[4]=1359893119,o[5]=2600822924,o[6]=528734635,o[7]=1541459225,i[0]=4089235720,i[1]=2227873595,i[2]=4271175723,i[3]=1595750129,i[4]=2917565137,i[5]=725511199,i[6]=4215389547,i[7]=327033209,Q(o,i,t,n),n%=128,e=0;e<n;e++)h[e]=t[a-n+e];for(h[n]=128,h[(n=256-128*(n<112?1:0))-9]=0,f(h,n-8,a/536870912|0,a<<3),Q(o,i,h,n),e=0;e<8;e++)f(r,8*e,o[e],i[e]);return 0}function $(r,t){var n=v(),e=v(),o=v(),i=v(),h=v(),a=v(),f=v(),s=v(),u=v();C(n,r[1],r[0]),C(u,t[1],t[0]),F(n,n,u),O(e,r[0],r[1]),O(u,t[0],t[1]),F(e,e,u),F(o,r[3],t[3]),F(o,o,y),F(i,r[2],t[2]),O(i,i,i),C(h,e,n),C(a,i,o),O(f,i,o),O(s,e,n),F(r[0],h,a),F(r[1],s,f),F(r[2],f,a),F(r[3],h,s)}function rr(r,t,n){var e;for(e=0;e<4;e++)T(r[e],t[e],n)}function tr(r,t){var n=v(),e=v(),o=v();Z(o,t[2]),F(n,t[0],o),F(e,t[1],o),z(r,e),r[31]^=P(n)<<7}function nr(r,t,n){var e,o;for(Y(r[0],s),Y(r[1],u),Y(r[2],u),Y(r[3],s),o=255;0<=o;--o)rr(r,t,e=n[o/8|0]>>(7&o)&1),$(t,r),$(r,r),rr(r,t,e)}function er(r,t){var n=[v(),v(),v(),v()];Y(n[0],e),Y(n[1],a),Y(n[2],u),F(n[3],e,a),nr(r,n,t)}function or(r,t,n){var e,o=new Uint8Array(64),i=[v(),v(),v(),v()];for(n||h(t,32),W(o,t,32),o[0]&=248,o[31]&=127,o[31]|=64,er(i,o),tr(r,i),e=0;e<32;e++)t[e+32]=r[e];return 0}var ir=new Float64Array([237,211,245,92,26,99,18,88,214,156,247,162,222,249,222,20,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16]);function hr(r,t){var n,e,o,i;for(e=63;32<=e;--e){for(n=0,o=e-32,i=e-12;o<i;++o)t[o]+=n-16*t[e]*ir[o-(e-32)],n=Math.floor((t[o]+128)/256),t[o]-=256*n;t[o]+=n,t[e]=0}for(o=n=0;o<32;o++)t[o]+=n-(t[31]>>4)*ir[o],n=t[o]>>8,t[o]&=255;for(o=0;o<32;o++)t[o]-=n*ir[o];for(e=0;e<32;e++)t[e+1]+=t[e]>>8,r[e]=255&t[e]}function ar(r){var t,n=new Float64Array(64);for(t=0;t<64;t++)n[t]=r[t];for(t=0;t<64;t++)r[t]=0;hr(r,n)}function fr(r,t,n,e){var o,i,h=new Uint8Array(64),a=new Uint8Array(64),f=new Uint8Array(64),s=new Float64Array(64),u=[v(),v(),v(),v()];W(h,e,32),h[0]&=248,h[31]&=127,h[31]|=64;var c=n+64;for(o=0;o<n;o++)r[64+o]=t[o];for(o=0;o<32;o++)r[32+o]=h[32+o];for(W(f,r.subarray(32),n+32),ar(f),er(u,f),tr(r,u),o=32;o<64;o++)r[o]=e[o];for(W(a,r,n+64),ar(a),o=0;o<64;o++)s[o]=0;for(o=0;o<32;o++)s[o]=f[o];for(o=0;o<32;o++)for(i=0;i<32;i++)s[o+i]+=a[o]*h[i];return hr(r.subarray(32),s),c}function sr(r,t,n,e){var o,i=new Uint8Array(32),h=new Uint8Array(64),a=[v(),v(),v(),v()],f=[v(),v(),v(),v()];if(n<64)return-1;if(function(r,t){var n=v(),e=v(),o=v(),i=v(),h=v(),a=v(),f=v();if(Y(r[2],u),N(r[1],t),I(o,r[1]),F(i,o,c),C(o,o,r[2]),O(i,r[2],i),I(h,i),I(a,h),F(f,a,h),F(n,f,o),F(n,n,i),G(n,n),F(n,n,o),F(n,n,i),F(n,n,i),F(r[0],n,i),I(e,r[0]),F(e,e,i),R(e,o)&&F(r[0],r[0],l),I(e,r[0]),F(e,e,i),R(e,o))return 1;P(r[0])===t[31]>>7&&C(r[0],s,r[0]),F(r[3],r[0],r[1])}(f,e))return-1;for(o=0;o<n;o++)r[o]=t[o];for(o=0;o<32;o++)r[o+32]=e[o];if(W(h,r,n),ar(h),nr(a,f,h),er(f,t.subarray(32)),$(a,f),tr(i,a),n-=64,g(t,0,i,0)){for(o=0;o<n;o++)r[o]=0;return-1}for(o=0;o<n;o++)r[o]=t[o+64];return n}function ur(r,t){if(32!==r.length)throw new Error("bad key size");if(24!==t.length)throw new Error("bad nonce size")}function cr(){for(var r=0;r<arguments.length;r++)if(!(arguments[r]instanceof Uint8Array))throw new TypeError("unexpected type, use Uint8Array")}function yr(r){for(var t=0;t<r.length;t++)r[t]=0}i.lowlevel={crypto_core_hsalsa20:_,crypto_stream_xor:M,crypto_stream:x,crypto_stream_salsa20_xor:d,crypto_stream_salsa20:E,crypto_onetimeauth:B,crypto_onetimeauth_verify:S,crypto_verify_16:b,crypto_verify_32:g,crypto_secretbox:k,crypto_secretbox_open:K,crypto_scalarmult:q,crypto_scalarmult_base:D,crypto_box_beforenm:X,crypto_box_afternm:j,crypto_box:function(r,t,n,e,o,i){var h=new Uint8Array(32);return X(h,o,i),j(r,t,n,e,h)},crypto_box_open:function(r,t,n,e,o,i){var h=new Uint8Array(32);return X(h,o,i),H(r,t,n,e,h)},crypto_box_keypair:V,crypto_hash:W,crypto_sign:fr,crypto_sign_keypair:or,crypto_sign_open:sr,crypto_secretbox_KEYBYTES:32,crypto_secretbox_NONCEBYTES:24,crypto_secretbox_ZEROBYTES:32,crypto_secretbox_BOXZEROBYTES:16,crypto_scalarmult_BYTES:32,crypto_scalarmult_SCALARBYTES:32,crypto_box_PUBLICKEYBYTES:32,crypto_box_SECRETKEYBYTES:32,crypto_box_BEFORENMBYTES:32,crypto_box_NONCEBYTES:24,crypto_box_ZEROBYTES:32,crypto_box_BOXZEROBYTES:16,crypto_sign_BYTES:64,crypto_sign_PUBLICKEYBYTES:32,crypto_sign_SECRETKEYBYTES:64,crypto_sign_SEEDBYTES:32,crypto_hash_BYTES:64,gf:v,D:c,L:ir,pack25519:z,unpack25519:N,M:F,A:O,S:I,Z:C,pow2523:G,add:$,set25519:Y,modL:hr,scalarmult:nr,scalarbase:er},i.randomBytes=function(r){var t=new Uint8Array(r);return h(t,r),t},i.secretbox=function(r,t,n){cr(r,t,n),ur(n,t);for(var e=new Uint8Array(32+r.length),o=new Uint8Array(e.length),i=0;i<r.length;i++)e[i+32]=r[i];return k(o,e,e.length,t,n),o.subarray(16)},i.secretbox.open=function(r,t,n){cr(r,t,n),ur(n,t);for(var e=new Uint8Array(16+r.length),o=new Uint8Array(e.length),i=0;i<r.length;i++)e[i+16]=r[i];return e.length<32||0!==K(o,e,e.length,t,n)?null:o.subarray(32)},i.secretbox.keyLength=32,i.secretbox.nonceLength=24,i.secretbox.overheadLength=16,i.scalarMult=function(r,t){if(cr(r,t),32!==r.length)throw new Error("bad n size");if(32!==t.length)throw new Error("bad p size");var n=new Uint8Array(32);return q(n,r,t),n},i.scalarMult.base=function(r){if(cr(r),32!==r.length)throw new Error("bad n size");var t=new Uint8Array(32);return D(t,r),t},i.scalarMult.scalarLength=32,i.scalarMult.groupElementLength=32,i.box=function(r,t,n,e){var o=i.box.before(n,e);return i.secretbox(r,t,o)},i.box.before=function(r,t){cr(r,t),function(r,t){if(32!==r.length)throw new Error("bad public key size");if(32!==t.length)throw new Error("bad secret key size")}(r,t);var n=new Uint8Array(32);return X(n,r,t),n},i.box.after=i.secretbox,i.box.open=function(r,t,n,e){var o=i.box.before(n,e);return i.secretbox.open(r,t,o)},i.box.open.after=i.secretbox.open,i.box.keyPair=function(){var r=new Uint8Array(32),t=new Uint8Array(32);return V(r,t),{publicKey:r,secretKey:t}},i.box.keyPair.fromSecretKey=function(r){if(cr(r),32!==r.length)throw new Error("bad secret key size");var t=new Uint8Array(32);return D(t,r),{publicKey:t,secretKey:new Uint8Array(r)}},i.box.publicKeyLength=32,i.box.secretKeyLength=32,i.box.sharedKeyLength=32,i.box.nonceLength=24,i.box.overheadLength=i.secretbox.overheadLength,i.sign=function(r,t){if(cr(r,t),64!==t.length)throw new Error("bad secret key size");var n=new Uint8Array(64+r.length);return fr(n,r,r.length,t),n},i.sign.open=function(r,t){if(cr(r,t),32!==t.length)throw new Error("bad public key size");var n=new Uint8Array(r.length),e=sr(n,r,r.length,t);if(e<0)return null;for(var o=new Uint8Array(e),i=0;i<o.length;i++)o[i]=n[i];return o},i.sign.detached=function(r,t){for(var n=i.sign(r,t),e=new Uint8Array(64),o=0;o<e.length;o++)e[o]=n[o];return e},i.sign.detached.verify=function(r,t,n){if(cr(r,t,n),64!==t.length)throw new Error("bad signature size");if(32!==n.length)throw new Error("bad public key size");var e,o=new Uint8Array(64+r.length),i=new Uint8Array(64+r.length);for(e=0;e<64;e++)o[e]=t[e];for(e=0;e<r.length;e++)o[e+64]=r[e];return 0<=sr(i,o,o.length,n)},i.sign.keyPair=function(){var r=new Uint8Array(32),t=new Uint8Array(64);return or(r,t),{publicKey:r,secretKey:t}},i.sign.keyPair.fromSecretKey=function(r){if(cr(r),64!==r.length)throw new Error("bad secret key size");for(var t=new Uint8Array(32),n=0;n<t.length;n++)t[n]=r[32+n];return{publicKey:t,secretKey:new Uint8Array(r)}},i.sign.keyPair.fromSeed=function(r){if(cr(r),32!==r.length)throw new Error("bad seed size");for(var t=new Uint8Array(32),n=new Uint8Array(64),e=0;e<32;e++)n[e]=r[e];return or(t,n,!0),{publicKey:t,secretKey:n}},i.sign.publicKeyLength=32,i.sign.secretKeyLength=64,i.sign.seedLength=32,i.sign.signatureLength=64,i.hash=function(r){cr(r);var t=new Uint8Array(64);return W(t,r,r.length),t},i.hash.hashLength=64,i.verify=function(r,t){return cr(r,t),0!==r.length&&0!==t.length&&(r.length===t.length&&0===w(r,0,t,0,r.length))},i.setPRNG=function(r){h=r},function(){var o="undefined"!=typeof self?self.crypto||self.msCrypto:null;if(o&&o.getRandomValues){i.setPRNG(function(r,t){var n,e=new Uint8Array(t);for(n=0;n<t;n+=65536)o.getRandomValues(e.subarray(n,n+Math.min(t-n,65536)));for(n=0;n<t;n++)r[n]=e[n];yr(e)})}else"undefined"!=typeof require&&(o=require("crypto"))&&o.randomBytes&&i.setPRNG(function(r,t){var n,e=o.randomBytes(t);for(n=0;n<t;n++)r[n]=e[n];yr(e)})}()}("undefined"!=typeof module&&module.exports?module.exports:self.nacl=self.nacl||{});// --- Puzzle data: PackReader (offline packs) + API fetch (online) ---
let PUZZLE_API; // set after config is loaded
const TOTAL_PUZZLE_COUNT = 91024;
const OFFLINE_LEVEL_TOTALS_8 = {easy:23008,medium:22520,hard:31848,hell:13648};
const OFFLINE_LEVEL_TOTALS_1 = {easy:2876,medium:2815,hard:3981,hell:1706};
function _getOfflineTotals() { return getTransforms() === 1 ? OFFLINE_LEVEL_TOTALS_1 : OFFLINE_LEVEL_TOTALS_8; }
const PUZZLE_COUNT = TOTAL_PUZZLE_COUNT;
function getEffectivePuzzleCount() { return _appConfig.puzzleSet === 11378 ? 11378 : TOTAL_PUZZLE_COUNT; }

// Puzzle cell cache (puzzle_number -> [6 cell indices])
const _puzzleCache = {};

// Get puzzle cells: FullPack → API → MiniPack → fallback
async function getPuzzleCells(puzzleNumber) {
  if (_puzzleCache[puzzleNumber]) return _puzzleCache[puzzleNumber];
  // Try FullPack first
  if (_fullPackReader && _fullPackReader.canDecode(puzzleNumber)) {
    var cells = _fullPackReader.getPuzzleCells(puzzleNumber);
    if (cells) { _puzzleCache[puzzleNumber] = cells; return cells; }
  }
  // Try API
  try {
    if (_debugForceOffline) throw new Error('forced offline');
    const res = await fetch(PUZZLE_API + puzzleNumber, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    _puzzleCache[puzzleNumber] = data.cells;
    return data.cells;
  } catch (e) {
    console.warn('Puzzle fetch failed for #' + puzzleNumber + ':', e.message);
  }
  // Try MiniPack
  if (_miniPackReader && _miniPackReader.canDecode(puzzleNumber)) {
    var miniCells = _miniPackReader.getPuzzleCells(puzzleNumber);
    if (miniCells) { _puzzleCache[puzzleNumber] = miniCells; return miniCells; }
  }
  // Fallback: random puzzle from MiniPack
  if (_miniPackReader) {
    var fallbackNum = _miniPackReader.getRandomPuzzleNumber();
    var fallbackCells = _miniPackReader.getPuzzleCells(fallbackNum);
    if (fallbackCells) {
      currentPuzzleNumber = fallbackNum;
      _puzzleCache[fallbackNum] = fallbackCells;
      return fallbackCells;
    }
  }
  return null;
}

// Check if backend is reachable (cached result, refreshed periodically)
let _backendOnline = null; // null = unknown, true/false = checked
let _healthCheckPromise = null;

var _serverDataVersion = null; // fetched from /version endpoint
var _serverOrderingId = null; // fetched from /version endpoint

async function checkBackendHealth() {
  if (_debugForceOffline) return false;
  try {
    const res = await fetch(WORKER_URL + '/health', { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = await res.json();
    // Read version info from merged /health response
    if (data.data_version && !_serverDataVersion) {
      _serverDataVersion = data.data_version;
    }
    if (data.ordering_id && !_serverOrderingId) {
      _serverOrderingId = data.ordering_id;
      _checkOrderingMismatch();
    }
    return data.status === 'ok';
  } catch { return false; }
}

// --- Health poll infrastructure ---
var _healthPollInterval = null;
var HEALTH_POLL_MS = 600000; // 10 minutes
var _lastHealthCheck = 0;

function _kickHealthCheck(force) {
  if (!force && Date.now() - _lastHealthCheck < HEALTH_POLL_MS) return;
  return refreshBackendStatus()
    .then(updateOnlineUI)
    .finally(function() { _lastHealthCheck = Date.now(); });
}

function _startHealthPoll() {
  if (_healthPollInterval) return;
  _kickHealthCheck(false);
  _healthPollInterval = setInterval(function() {
    _kickHealthCheck(true);
  }, HEALTH_POLL_MS);
}

function _stopHealthPoll() {
  if (_healthPollInterval) {
    clearInterval(_healthPollInterval);
    _healthPollInterval = null;
  }
}

function refreshBackendStatus() {
  if (_healthCheckPromise) return _healthCheckPromise;
  _healthCheckPromise = checkBackendHealth().then(ok => {
    const prev = _backendOnline;
    _backendOnline = _debugForceOffline ? false : ok;
    _healthCheckPromise = null;
    if (ok !== prev) {
      fetchLevelTotals().then(() => updateWelcomeLevels());
    }
    return ok;
  });
  return _healthCheckPromise;
}

function isOnline() { return _backendOnline === true; }
function _setBackendOnline(val) { _backendOnline = val; }

// Get a valid puzzle number for current mode
function getRandomPuzzleNumber() {
  if (_fullPackReader) return Math.floor(Math.random() * TOTAL_PUZZLE_COUNT) + 1;
  if (_backendOnline === false && _miniPackReader) return _miniPackReader.getRandomPuzzleNumber();
  return Math.floor(Math.random() * TOTAL_PUZZLE_COUNT) + 1;
}

function getMaxPuzzleNumber() {
  return TOTAL_PUZZLE_COUNT;
}

// Convert display index (1-based) to puzzle number
function displayToPuzzleNumber(displayVal) {
  return displayVal;
}

function puzzleNumberToDisplay(puzzleNumber) {
  return puzzleNumber;
}

// --- Level-based game flow ---
const LEVELS = ['easy', 'medium', 'hard', 'hell'];
const LEVEL_COLORS = { easy: '#2ecc71', medium: '#3498db', hard: '#e67e22', hell: '#9b59b6' };
const LEVEL_DOTS = { easy: '🟢', medium: '🔵', hard: '🟠', hell: '🟣' };
const CHAPTER_SIZES_8 = { easy: 800, medium: 800, hard: 1000, hell: 500 };
const CHAPTER_SIZES_1 = { easy: 100, medium: 100, hard: 125, hell: 65 };
const SUB_PAGE_SIZE = 100;
function getChapterSize(level) {
  var sizes = getTransforms() === 1 ? CHAPTER_SIZES_1 : CHAPTER_SIZES_8;
  return sizes[level] || (getTransforms() === 1 ? 100 : 800);
}
const WORLD_THEMES = {
  easy: { icon: '🌿', gradient: 'linear-gradient(135deg, #27ae60, #2ecc71)' },
  medium: { icon: '🌊', gradient: 'linear-gradient(135deg, #2980b9, #3498db)' },
  hard: { icon: '🌋', gradient: 'linear-gradient(135deg, #d35400, #e67e22)' },
  hell: { icon: '🌌', gradient: 'linear-gradient(135deg, #8e44ad, #9b59b6)' },
};
let _levelTotals = {}; // { easy: 23008, medium: 22520, ... }
const OFFLINE_LEVEL_MAX = 22; // number of bundled puzzles per level
let currentLevel = null; // null = free play, 'easy'/'medium'/'hard'/'hell'
let currentSlot = 0; // 1-based slot within current level

// Demo puzzle caps per difficulty — total puzzles available in demo mode.
// Rationale:
//   Easy   50 (5 chapters, ~30 min) — learn mechanics, feel progression
//   Medium 20 (2 chapters, ~30 min) — introduces harder pacing
//   Hard   10 (1 chapter,  ~20 min) — taste of difficulty, not enough to master
//   Hell    5 (½ chapter,  ~15 min) — just a glimpse
// Total: ~85 puzzles, ~1.5h play. CTA also triggers at 10 total solves (whichever first).
// Can be overridden via config.demoCaps for build variants.
var DEMO_LEVEL_CAPS = { easy: 50, medium: 20, hard: 10, hell: 5 };

function getEffectiveLevelTotal(level) {
  var total = _levelTotals[level] || 0;
  // FullPack provides all levels offline
  if (_fullPackReader && _fullPackReader.hasOrdering) {
    var packTotal = _fullPackReader.getLevelTotal(level);
    if (packTotal > 0) total = packTotal;
  }
  if (!isOnline() && !_fullPackReader) return Math.min(total, OFFLINE_LEVEL_MAX);
  if (_isDemoMode) {
    // Use config demoCaps if available, fallback to default
    var caps = (_appConfig.demoCaps && _appConfig.demoCaps[level]) || DEMO_LEVEL_CAPS[level] || 50;
    return Math.min(total, caps);
  }
  return total;
}

function getLevelProgress(level) {
  return parseInt(localStorage.getItem('octile_level_' + level) || '0');
}

function setLevelProgress(level, completed) {
  localStorage.setItem('octile_level_' + level, completed);
}

async function fetchLevelTotals() {
  // Try FullPack first
  if (_fullPackReader && _fullPackReader.hasOrdering) {
    var packTotals = _fullPackReader.getAllLevelTotals();
    if (packTotals.easy > 0) {
      _levelTotals = packTotals;
      // FullPack is SSOT: return immediately (don't let API overwrite)
      return;
    }
  }
  // No FullPack: need API fallback, but only if config loaded
  if (!_configLoaded || _isPureMode) return;

  try {
    if (_debugForceOffline) throw new Error('forced offline');
    const res = await fetch(WORKER_URL + '/levels?transforms=' + getTransforms(), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var apiTotals = await res.json();
    // If backend doesn't support transforms param, divide client-side
    if (getTransforms() === 1 && apiTotals.easy > 11378) {
      for (var k in apiTotals) apiTotals[k] = Math.floor(apiTotals[k] / 8);
    }
    // Defensive: only write if FullPack didn't already set totals
    if (!_levelTotals || !_levelTotals.easy) _levelTotals = apiTotals;
  } catch {
    if (!_levelTotals || !_levelTotals.easy) _levelTotals = {..._getOfflineTotals()};
  }
}

async function fetchLevelPuzzle(level, slot, forceAPI = false) {
  // For Daily Challenge, always use backend API to get authoritative puzzle_number
  // (FullPack may have different base ordering than backend database)
  if (!forceAPI && _fullPackReader && _fullPackReader.hasOrdering) {
    var puzzleNum = _fullPackReader.levelSlotToPuzzle(level, slot);
    if (puzzleNum) {
      var cells = _fullPackReader.getPuzzleCells(puzzleNum);
      if (cells) {
        _puzzleCache[puzzleNum] = cells;
        return { puzzle_number: puzzleNum, level: level, slot: slot, total: _fullPackReader.getLevelTotal(level), cells: cells };
      }
    }
  }
  // Try API
  try {
    if (_debugForceOffline) throw new Error('forced offline');
    const res = await fetch(WORKER_URL + '/level/' + level + '/puzzle/' + slot + '?transforms=8', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    // If we got puzzle from API, also try to load cells from FullPack (may have them cached)
    if (!data.cells && _fullPackReader && data.puzzle_number) {
      var cells = _fullPackReader.getPuzzleCells(data.puzzle_number);
      if (cells) data.cells = cells;
    }
    _puzzleCache[data.puzzle_number] = data.cells;
    return data;
  } catch {
    // Offline fallback: try FullPack if we skipped it earlier
    if (forceAPI && _fullPackReader && _fullPackReader.hasOrdering) {
      var puzzleNum = _fullPackReader.levelSlotToPuzzle(level, slot);
      if (puzzleNum) {
        var cells = _fullPackReader.getPuzzleCells(puzzleNum);
        if (cells) {
          _puzzleCache[puzzleNum] = cells;
          return { puzzle_number: puzzleNum, level: level, slot: slot, total: _fullPackReader.getLevelTotal(level), cells: cells };
        }
      }
    }
    throw new Error('Puzzle not available offline');
  }
}

function getFirstUnsolvedPuzzleNumber() {
  const solvedSet = getSolvedSet();
  let firstUnsolved = 1;
  while (solvedSet.has(firstUnsolved)) firstUnsolved++;
  return firstUnsolved;
}

function getDailyChallengeSlot(date, level) {
  // FNV-1a hash (identical to backend _daily_challenge_slot)
  // Deterministic: same date+level always gives same slot
  const key = `${date}:${level}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Daily Challenge always uses transforms=8 (backend authoritative)
  const total = _getDCLevelTotal(level);
  if (!total || total <= 0) throw new Error(`Level ${level} has no puzzles`);
  const slot = ((h >>> 0) % total) + 1;
  return slot;
}

function _getDCLevelTotal(level) {
  // DC always uses full transform set (×8) regardless of puzzleSet config
  // This matches backend's authoritative calculation
  return OFFLINE_LEVEL_TOTALS_8[level] || 0;
}

function isLevelUnlocked(level) {
  if (!isBlockUnsolved()) return true; // all levels unlocked when free
  const idx = LEVELS.indexOf(level);
  if (idx <= 0) return true; // easy is always unlocked
  const prev = LEVELS[idx - 1];
  const prevTotal = getEffectiveLevelTotal(prev);
  return prevTotal > 0 && getLevelProgress(prev) >= prevTotal;
}

// --- 3-Tier Navigation ---
let _navWorld = null;   // current world (level key) for tier 2/3
let _navChapter = null; // current chapter index (0-based) for tier 3
let _navSubPage = 0;    // current sub-page (0-based) for tier 3 pagination

function getChapterCount(level) {
  return Math.ceil(getEffectiveLevelTotal(level) / getChapterSize(level));
}

function getChapterProgress(level, chapterIdx) {
  const completed = getLevelProgress(level);
  const chSize = getChapterSize(level);
  const chapterStart = chapterIdx * chSize;
  const total = getEffectiveLevelTotal(level);
  const chapterTotal = Math.min(chSize, total - chapterStart);
  const chapterDone = Math.max(0, Math.min(chapterTotal, completed - chapterStart));
  return { done: chapterDone, total: chapterTotal };
}

// Tier 1: World Hub (horizontal carousel)
let _carouselIdx = 0;

function _goToSlide(idx) {
  idx = Math.max(0, Math.min(LEVELS.length - 1, idx));
  _carouselIdx = idx;
  const track = document.querySelector('.carousel-track');
  if (track) track.style.transform = 'translateX(-' + (idx * 100) + '%)';
  document.querySelectorAll('.carousel-dots .dot').forEach(function(d, i) {
    d.classList.toggle('active', i === idx);
  });
  var arrows = document.querySelectorAll('.carousel-arrow');
  if (arrows.length === 2) {
    arrows[0].disabled = idx === 0;
    arrows[1].disabled = idx === LEVELS.length - 1;
  }
}

function renderWorldHub() {
  // Wait for config to load before setting offline defaults
  if (!_levelTotals.easy && _configLoaded) _levelTotals = {..._getOfflineTotals()};
  const container = document.getElementById('wp-world-map');
  container.innerHTML = '';
  let firstIncomplete = 0;

  // Build slides
  var trackHtml = '';
  for (let i = 0; i < LEVELS.length; i++) {
    const level = LEVELS[i];
    const total = getEffectiveLevelTotal(level);
    const completed = getLevelProgress(level);
    const pct = total > 0 ? Math.min(100, completed / total * 100) : 0;
    const unlocked = isLevelUnlocked(level);
    const isComplete = total > 0 && completed >= total;
    const theme = WORLD_THEMES[level];
    const color = LEVEL_COLORS[level];
    const chapters = getChapterCount(level);

    if (unlocked && !isComplete && firstIncomplete === 0 && i > 0) firstIncomplete = i;
    // If first world is incomplete, firstIncomplete stays 0

    // Current chapter info
    var chSize = getChapterSize(level);
    var currentChapter = Math.floor(completed / chSize);
    var chapterInProgress = completed - currentChapter * chSize;
    var chapterTotal = Math.min(chSize, total - currentChapter * chSize);
    if (completed >= total) currentChapter = chapters - 1;

    let statusText = '';
    if (!unlocked) {
      statusText = t('wp_unlock_req').replace('{level}', t('level_' + LEVELS[i - 1]));
    } else if (isComplete) {
      statusText = '\u2713 ' + t('wp_completed');
    } else {
      statusText = t('wp_chapter_progress')
        .replace('{ch}', currentChapter + 1)
        .replace('{total}', chapters)
        .replace('{done}', chapterInProgress)
        .replace('{size}', chapterTotal);
    }

    var cls = 'world-slide';
    if (!unlocked) cls += ' locked';
    if (isComplete) cls += ' completed';
    if (unlocked && !isComplete) cls += ' active';

    trackHtml += '<div class="' + cls + '" data-level="' + level + '" data-idx="' + i + '">' +
      '<div class="world-landscape">' +
        '<span class="world-badge">' + (i + 1) + '</span>' +
        '<span class="world-emoji">' + theme.icon + '</span>' +
        (!unlocked ? '<span class="world-lock">\uD83D\uDD12</span>' : '') +
      '</div>' +
      '<div class="world-details">' +
        '<div class="world-name">' + t('world_' + level) + '</div>' +
        '<div class="world-subtitle">' + t('level_' + level) + '</div>' +
        '<div class="world-counts">' + statusText + '</div>' +
        '<div class="world-bar"><div class="world-fill" style="width:' + pct.toFixed(1) + '%;background:' + color + '"></div></div>' +
        '<div class="world-pct" style="color:' + color + '">' + Math.floor(pct) + '%</div>' +
      '</div>' +
    '</div>';
  }

  container.innerHTML =
    '<div class="carousel-track">' + trackHtml + '</div>' +
    '<div class="carousel-nav">' +
      '<button class="carousel-arrow left" aria-label="Previous">\u25C0</button>' +
      '<div class="carousel-dots">' +
        LEVELS.map(function(_, i) { return '<span class="dot' + (i === firstIncomplete ? ' active' : '') + '"></span>'; }).join('') +
      '</div>' +
      '<button class="carousel-arrow right" aria-label="Next">\u25B6</button>' +
    '</div>';

  // Click handlers for slides
  container.querySelectorAll('.world-slide:not(.locked)').forEach(function(slide) {
    slide.addEventListener('click', function() {
      openChapterGrid(slide.dataset.level);
    });
  });

  // Arrow navigation
  container.querySelector('.carousel-arrow.left').addEventListener('click', function(e) {
    e.stopPropagation();
    _goToSlide(_carouselIdx - 1);
  });
  container.querySelector('.carousel-arrow.right').addEventListener('click', function(e) {
    e.stopPropagation();
    _goToSlide(_carouselIdx + 1);
  });

  // Dot navigation
  container.querySelectorAll('.carousel-dots .dot').forEach(function(dot, i) {
    dot.addEventListener('click', function(e) {
      e.stopPropagation();
      _goToSlide(i);
    });
  });

  // Touch/pointer swipe
  var track = container.querySelector('.carousel-track');
  var startX = 0, startY = 0, dragging = false, dx = 0, swiping = false;
  track.addEventListener('pointerdown', function(e) {
    startX = e.clientX; startY = e.clientY; dragging = true; dx = 0; swiping = false;
  });
  track.addEventListener('pointermove', function(e) {
    if (!dragging) return;
    dx = e.clientX - startX;
    var dy = e.clientY - startY;
    if (!swiping && Math.abs(dx) > 10) {
      swiping = true;
      track.setPointerCapture(e.pointerId);
      track.style.transition = 'none';
    }
    if (!swiping) return;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 10) return;
    var base = -_carouselIdx * 100;
    var offset = dx / container.offsetWidth * 100;
    track.style.transform = 'translateX(' + (base + offset) + '%)';
  });
  function endSwipe() {
    if (!dragging) return;
    dragging = false;
    if (!swiping) return;
    swiping = false;
    track.style.transition = '';
    if (dx > 50) _goToSlide(_carouselIdx - 1);
    else if (dx < -50) _goToSlide(_carouselIdx + 1);
    else _goToSlide(_carouselIdx);
  }
  track.addEventListener('pointerup', endSwipe);
  track.addEventListener('pointercancel', endSwipe);

  // Set initial slide
  _carouselIdx = firstIncomplete;
  _goToSlide(firstIncomplete);

  // Keyboard nav when world hub is visible
  container._keyHandler = function(e) {
    if (document.getElementById('welcome-panel').classList.contains('hidden')) return;
    if (document.getElementById('chapter-modal').classList.contains('show')) return;
    if (e.key === 'ArrowLeft') _goToSlide(_carouselIdx - 1);
    else if (e.key === 'ArrowRight') _goToSlide(_carouselIdx + 1);
  };
  document.removeEventListener('keydown', container._prevKeyHandler);
  document.addEventListener('keydown', container._keyHandler);
  container._prevKeyHandler = container._keyHandler;

  // Quick resume
  const resumeBtn = document.getElementById('wp-resume');
  let resumeLevel = null;
  for (const level of LEVELS) {
    const total = getEffectiveLevelTotal(level);
    const completed = getLevelProgress(level);
    if (isLevelUnlocked(level) && total > 0 && completed < total) {
      resumeLevel = level;
      break;
    }
  }
  if (resumeLevel) {
    const slot = getLevelProgress(resumeLevel) + 1;
    resumeBtn.innerHTML = '\u25B6 ' + t('wp_resume').replace('{level}', t('level_' + resumeLevel)).replace('{n}', slot);
    // Add last played time if available
    var _lastPlayed = localStorage.getItem('octile_last_played');
    if (_lastPlayed) {
      var _ago = formatRelativeTime(parseInt(_lastPlayed));
      resumeBtn.innerHTML += '<span class="wp-resume-ago">' + _ago + '</span>';
    }
    resumeBtn.style.display = '';
    resumeBtn.onclick = () => startLevel(resumeLevel);
  } else {
    resumeBtn.style.display = 'none';
  }
}

// Tier 2: Chapter Grid (full-screen modal)
function openChapterGrid(level) {
  _navWorld = level;
  const total = getEffectiveLevelTotal(level);
  const completed = getLevelProgress(level);
  const chapters = getChapterCount(level);
  const color = LEVEL_COLORS[level];

  document.getElementById('chapter-title').textContent = t('world_' + level);
  document.getElementById('chapter-progress').textContent = completed.toLocaleString() + ' / ' + total.toLocaleString();

  const grid = document.getElementById('chapter-grid');
  grid.innerHTML = '';

  // Find active chapter (first incomplete)
  let activeChapter = -1;
  for (let c = 0; c < chapters; c++) {
    const cp = getChapterProgress(level, c);
    if (cp.done < cp.total) { activeChapter = c; break; }
  }

  for (let c = 0; c < chapters; c++) {
    const cp = getChapterProgress(level, c);
    const pct = cp.total > 0 ? (cp.done / cp.total * 100) : 0;
    const isDone = cp.done >= cp.total;
    const isChapterActive = c === activeChapter;
    const isLocked = c > 0 && !isDone && c > activeChapter;

    const tile = document.createElement('button');
    tile.className = 'chapter-tile' + (isDone ? ' done' : '') + (isChapterActive ? ' active' : '') + (isLocked ? ' locked' : '');
    tile.style.setProperty('--ch-color', color);
    tile.disabled = isLocked;

    if (isDone) {
      tile.innerHTML = '<span class="ch-num">' + (c + 1) + '</span><span class="ch-check">\u2713</span>';
    } else if (pct > 0) {
      // Ring progress
      const deg = Math.round(pct * 3.6);
      tile.style.setProperty('--ch-deg', deg + 'deg');
      tile.innerHTML = '<span class="ch-num">' + (c + 1) + '</span>';
      tile.classList.add('partial');
    } else {
      tile.innerHTML = '<span class="ch-num">' + (c + 1) + '</span>';
    }

    if (!isLocked) {
      tile.addEventListener('click', () => openPuzzlePath(level, c));
    }
    grid.appendChild(tile);
  }

  // Fill empty slots up to 35 (7x5 grid)
  const gridSlots = 35;
  for (let i = chapters; i < gridSlots; i++) {
    const filler = document.createElement('div');
    filler.className = 'chapter-tile filler';
    grid.appendChild(filler);
  }

  // Show modal (no scroll needed — grid fits in view)
  document.getElementById('chapter-modal').classList.add('show');
}

// Tier 3: Puzzle Path (Snake, full-screen modal) with sub-page pagination
function openPuzzlePath(level, chapterIdx) {
  _navWorld = level;
  _navChapter = chapterIdx;

  const total = getEffectiveLevelTotal(level);
  const completed = getLevelProgress(level);
  const chSize = getChapterSize(level);
  const chapterStart = chapterIdx * chSize;
  const chapterTotal = Math.min(chSize, total - chapterStart);
  const chapterDone = Math.max(0, Math.min(chapterTotal, completed - chapterStart));
  const totalPages = Math.ceil(chapterTotal / SUB_PAGE_SIZE);

  // Auto-detect correct sub-page: page containing next unsolved puzzle
  const nextUnsolved = chapterDone; // 0-based index within chapter
  _navSubPage = Math.min(Math.floor(nextUnsolved / SUB_PAGE_SIZE), totalPages - 1);

  renderPuzzlePage(level, chapterIdx, _navSubPage);

  document.getElementById('path-modal').classList.add('show');
  setTimeout(() => {
    const nextNode = document.getElementById('path-grid').querySelector('.path-node.next');
    if (nextNode) nextNode.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 100);
}

function renderPuzzlePage(level, chapterIdx, subPage) {
  const total = getEffectiveLevelTotal(level);
  const completed = getLevelProgress(level);
  const chSize = getChapterSize(level);
  const chapterStart = chapterIdx * chSize;
  const chapterTotal = Math.min(chSize, total - chapterStart);
  const chapterDone = Math.max(0, Math.min(chapterTotal, completed - chapterStart));
  const color = LEVEL_COLORS[level];
  const totalPages = Math.ceil(chapterTotal / SUB_PAGE_SIZE);

  document.getElementById('path-title').textContent = t('world_' + level) + ' \u2014 ' + t('wp_chapter') + ' ' + (chapterIdx + 1);
  document.getElementById('path-progress').textContent = chapterDone + ' / ' + chapterTotal;

  // Sub-page range
  const pageStart = subPage * SUB_PAGE_SIZE; // 0-based within chapter
  const pageEnd = Math.min(pageStart + SUB_PAGE_SIZE, chapterTotal);
  const pageCount = pageEnd - pageStart;

  const pathEl = document.getElementById('path-grid');
  pathEl.innerHTML = '';

  // Pagination bar (if more than 1 page)
  if (totalPages > 1) {
    const paginationEl = document.createElement('div');
    paginationEl.className = 'path-pagination';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'path-page-btn';
    prevBtn.textContent = '\u25C0';
    prevBtn.disabled = subPage <= 0;
    prevBtn.addEventListener('click', () => { _navSubPage = subPage - 1; renderPuzzlePage(level, chapterIdx, _navSubPage); });
    const label = document.createElement('span');
    label.className = 'path-page-label';
    label.textContent = (subPage + 1) + ' / ' + totalPages;
    const nextBtn = document.createElement('button');
    nextBtn.className = 'path-page-btn';
    nextBtn.textContent = '\u25B6';
    nextBtn.disabled = subPage >= totalPages - 1;
    nextBtn.addEventListener('click', () => { _navSubPage = subPage + 1; renderPuzzlePage(level, chapterIdx, _navSubPage); });
    paginationEl.appendChild(prevBtn);
    paginationEl.appendChild(label);
    paginationEl.appendChild(nextBtn);
    pathEl.appendChild(paginationEl);
  }

  const COLS = 5;
  const rows = Math.ceil(pageCount / COLS);

  for (let r = 0; r < rows; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'path-row' + (r % 2 === 1 ? ' reverse' : '');

    for (let c = 0; c < COLS; c++) {
      const idxInPage = r * COLS + c;
      if (idxInPage >= pageCount) break;
      const idxInChapter = pageStart + idxInPage;
      const slot = chapterStart + idxInChapter + 1; // 1-based global slot
      const isSolved = slot <= completed;
      const isNext = isBlockUnsolved() && slot === completed + 1;
      const isNodeLocked = isBlockUnsolved() && slot > completed + 1;

      const node = document.createElement('button');
      node.className = 'path-node' + (isSolved ? ' solved' : '') + (isNext ? ' next' : '') + (isNodeLocked ? ' locked' : '');
      node.style.setProperty('--node-color', color);

      // Display number within chapter (1-based)
      const displayNum = idxInChapter + 1;
      if (isSolved) {
        node.innerHTML = '<span class="node-check">\u2713</span>';
      } else {
        node.innerHTML = '<span class="node-num">' + displayNum + '</span>';
      }

      if (!isNodeLocked) {
        node.addEventListener('click', async () => {
          document.getElementById('path-modal').classList.remove('show');
          document.getElementById('chapter-modal').classList.remove('show');
          currentLevel = level;
          currentSlot = slot;
          try {
            const data = await fetchLevelPuzzle(level, slot);
            currentPuzzleNumber = data.puzzle_number;
            startGame(currentPuzzleNumber);
          } catch (e) {
            console.warn('[Octile] Puzzle fetch failed:', e.message);
            alert(t('offline_level_limit'));
          }
        });
      }

      rowEl.appendChild(node);

      // Add connector between nodes (except last in row)
      if (c < COLS - 1 && idxInPage + 1 < pageCount) {
        const conn = document.createElement('div');
        conn.className = 'path-conn' + (slot < completed ? ' done' : slot === completed ? ' active' : '');
        rowEl.appendChild(conn);
      }
    }

    pathEl.appendChild(rowEl);

    // Add vertical connector between rows
    if (r < rows - 1) {
      const vconn = document.createElement('div');
      vconn.className = 'path-vconn' + (r % 2 === 1 ? ' left' : ' right');
      const lastInRow = Math.min((r + 1) * COLS, pageCount);
      const slotAtEnd = chapterStart + pageStart + lastInRow;
      vconn.classList.toggle('done', slotAtEnd <= completed);
      pathEl.appendChild(vconn);
    }
  }

  // Play Next button
  const playBtn = document.getElementById('path-play-next');
  if (chapterDone < chapterTotal) {
    const nextSlot = chapterStart + chapterDone + 1;
    playBtn.textContent = '\u25B6 ' + t('wp_play_next');
    playBtn.style.display = '';
    playBtn.onclick = async () => {
      document.getElementById('path-modal').classList.remove('show');
      document.getElementById('chapter-modal').classList.remove('show');
      currentLevel = level;
      currentSlot = nextSlot;
      try {
        const data = await fetchLevelPuzzle(level, nextSlot);
        currentPuzzleNumber = data.puzzle_number;
        startGame(currentPuzzleNumber);
      } catch (e) {
        console.warn('[Octile] Puzzle fetch failed:', e.message);
        alert(t('offline_level_limit'));
      }
    };
  } else {
    playBtn.style.display = 'none';
  }
}

function showTier1() {
  _navWorld = null;
  _navChapter = null;
  renderWorldHub();
}

// Kept for compatibility — delegates to new system
function updateWelcomeLevels() {
  renderWorldHub();
}

async function startLevel(level) {
  if (!isLevelUnlocked(level)) return;
  _isDailyChallenge = false;
  _dailyChallengeLevel = null;
  _dailyDate = null;
  if (!hasEnoughEnergy()) { showEnergyModal(true); return; }
  const total = getEffectiveLevelTotal(level);
  if (total === 0) return; // level data not loaded
  currentLevel = level;
  currentSlot = getLevelProgress(level) + 1;
  if (currentSlot > total) {
    showLevelComplete(level, total);
    return;
  }
  try {
    const data = await fetchLevelPuzzle(level, currentSlot);
    currentPuzzleNumber = data.puzzle_number;
    startGame(currentPuzzleNumber);
  } catch (e) {
    console.warn('[Octile] Level puzzle fetch failed:', e.message);
    currentLevel = null;
    alert(t('offline_level_limit'));
  }
}

function advanceLevelProgress() {
  if (!currentLevel) return;
  const completed = getLevelProgress(currentLevel);
  if (currentSlot > completed) {
    setLevelProgress(currentLevel, currentSlot);
  }
}

function updateLevelNav() {
  const nav = document.getElementById('level-nav');
  // Show level nav only during active gameplay
  if (!currentLevel || !document.body.classList.contains('in-game')) {
    nav.style.display = 'none';
    return;
  }
  nav.style.display = '';
  const total = getEffectiveLevelTotal(currentLevel);
  const completed = getLevelProgress(currentLevel);
  document.getElementById('level-label').textContent =
    (LEVEL_DOTS[currentLevel] || '') + ' ' + t('level_' + currentLevel) + ' #' + currentSlot;
  const prevBtn = document.getElementById('level-prev');
  const nextBtn = document.getElementById('level-next');
  prevBtn.disabled = currentSlot <= 1;
  // Only disable "next" when it is DEFINITELY not allowed:
  // (1) at level end (if total is known), OR
  // (2) at/past the frontier slot (completed + 1)
  const atEnd = total > 0 && currentSlot >= total;
  const frontierSlot = completed + 1;
  const atFrontier = currentSlot >= frontierSlot;
  nextBtn.disabled = atEnd || atFrontier;
}

async function goLevelSlot(slot) {
  if (!currentLevel) return;
  const total = getEffectiveLevelTotal(currentLevel);
  const completed = getLevelProgress(currentLevel);
  if (slot < 1 || (total > 0 && slot > total)) return;
  const targetSlot = slot;
  const isForward = targetSlot > currentSlot;
  const frontierSlot = completed + 1;
  if (isForward && targetSlot > frontierSlot) {
    playSound('error');
    updateLevelNav();
    return;
  }
  try {
    const data = await fetchLevelPuzzle(currentLevel, targetSlot);
    currentSlot = targetSlot;
    currentPuzzleNumber = data.puzzle_number;
    await resetGame(currentPuzzleNumber);
    updateLevelNav();
  } catch (e) {
    console.warn('[Octile] Level puzzle fetch failed:', e.message);
    alert(t('offline_level_limit'));
    updateLevelNav();
  }
}

const BOARD_SIZE = 8;
const PIECE_CELL_PX = 28; // mobile default; overridden dynamically on desktop


// Backtracking solver for hint (non-grey pieces, sorted largest first)
const SOLVER_PIECES = [
  { id: 'blue2',  base: [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3],[2,0],[2,1],[2,2],[2,3]] },
  { id: 'blue1',  base: [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[1,1],[1,2],[1,3],[1,4]] },
  { id: 'yel1',   base: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]] },
  { id: 'yel2',   base: [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3]] },
  { id: 'red1',   base: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]] },
  { id: 'white1', base: [[0,0],[0,1],[0,2],[0,3],[0,4]] },
  { id: 'red2',   base: [[0,0],[0,1],[0,2],[0,3]] },
  { id: 'white2', base: [[0,0],[0,1],[1,0],[1,1]] },
];

function solverGetRotations(cells) {
  const seen = new Set(), results = [];
  let cur = cells;
  for (let r = 0; r < 4; r++) {
    const minR = Math.min(...cur.map(c => c[0]));
    const minC = Math.min(...cur.map(c => c[1]));
    const norm = cur.map(c => [c[0] - minR, c[1] - minC]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const key = norm.toString();
    if (!seen.has(key)) { seen.add(key); results.push(norm); }
    cur = cur.map(c => [c[1], -c[0]]);
  }
  return results;
}

const SOLVER_SHAPES = SOLVER_PIECES.map(p => ({
  id: p.id,
  rotations: solverGetRotations(p.base)
}));

function solvePuzzle(greyBoard) {
  const bd = greyBoard.map(r => [...r]);
  const placed = new Array(SOLVER_SHAPES.length).fill(false);

  function solve() {
    let er = -1, ec = -1;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (!bd[r][c]) { er = r; ec = c; r = 8; break; }
      }
    }
    if (er === -1) return true;

    for (let pi = 0; pi < SOLVER_SHAPES.length; pi++) {
      if (placed[pi]) continue;
      const sp = SOLVER_SHAPES[pi];
      for (const rot of sp.rotations) {
        for (const [ar, ac] of rot) {
          const offR = er - ar, offC = ec - ac;
          let fits = true;
          for (const [sr, sc] of rot) {
            const r = sr + offR, c = sc + offC;
            if (r < 0 || r >= 8 || c < 0 || c >= 8 || bd[r][c]) { fits = false; break; }
          }
          if (!fits) continue;
          placed[pi] = true;
          for (const [sr, sc] of rot) bd[sr + offR][sc + offC] = sp.id;
          if (solve()) return true;
          placed[pi] = false;
          for (const [sr, sc] of rot) bd[sr + offR][sc + offC] = null;
        }
      }
    }
    return false;
  }

  solve();
  return bd;
}




// Taglines, facts, quotes, nicknames — all loaded from translations.json

function _systemLang() { return /^(zh|ko|ja)/.test(navigator.language) ? 'zh' : 'en'; }
let _langPref = localStorage.getItem('octile_lang') || 'system';
let currentLang = _langPref === 'system' ? _systemLang() : _langPref;
let motivationShown = false;
let motivationTimeout = null;

function getTaglines() { return t('taglines'); }
function getWinFacts() { return t('win_facts'); }
function getMotivationQuotes() { return t('motivation_quotes'); }

let board = []; // 8x8, null or pieceId string
let pieces = [];
let timerInterval = null;
let startTime = 0;
let elapsed = 0;
let elapsedBeforePause = 0;
let paused = false;
let gameOver = false;
let currentPuzzleNumber = 1;
let currentSolution = null; // 8x8 array of piece IDs for hint
let hintTimeout = null;
var MAX_HINTS = 3;
var HINT_DIAMOND_COST = 100;
var UNLOCK_PUZZLE_DIAMOND_COST = 50;

function _loadHintData() {
  try { return JSON.parse(localStorage.getItem('octile_daily_hints') || '{}'); }
  catch { return {}; }
}

function _saveHintData(data) {
  localStorage.setItem('octile_daily_hints', JSON.stringify(data));
}

// Called when a new puzzle starts — roll over to today if date changed
function rolloverDailyHints() {
  const today = new Date().toISOString().slice(0, 10);
  const data = _loadHintData();
  if (data.date !== today) {
    _saveHintData({ date: today, used: 0 });
  }
}

function getHintsUsedToday() {
  if (_debugUnlimitedHints) return 0;
  return _loadHintData().used || 0;
}

function useHint() {
  if (_debugUnlimitedHints) return;
  const data = _loadHintData();
  data.used = (data.used || 0) + 1;
  _saveHintData(data);
}
let timerStarted = false;
let piecesPlacedCount = 0; // track for tutorial
let _moveLog = []; // [combined, combined, ...] — each placement recorded for anti-cheat
let _placementOrder = []; // piece IDs in placement order, for undo

// --- Daily Challenge (Steam-exclusive) ---

function getDailyChallengeDate() {
  return new Date().toISOString().slice(0, 10);
}

// --- API endpoints (default, overridden by config.json workerUrl) ---
let WORKER_URL = 'https://api.octile.eu.cc';
let SCORE_API_URL = WORKER_URL + '/score';
PUZZLE_API = WORKER_URL + '/puzzle/';
var SITE_URL = 'https://app.octile.eu.cc/';
const APP_VERSION_CODE = 24;
const APP_VERSION_NAME = '2.0.0';

// --- Send X-App-Version + credentials on all API calls ---
var _origFetch = window.fetch;
window.fetch = function(url, opts) {
  if (typeof url === 'string' && url.indexOf(WORKER_URL) === 0) {
    opts = opts || {};
    opts.headers = opts.headers instanceof Headers ? opts.headers : new Headers(opts.headers || {});
    opts.headers.set('X-App-Version', String(APP_VERSION_CODE));
    // Send cookies cross-origin so Worker can set/read octile_uid HttpOnly cookie
    if (!opts.credentials) opts.credentials = 'include';
    // Capture cookie UUID from response header (for local display use)
    return _origFetch.call(this, url, opts).then(function(resp) {
      if (typeof _captureCookieUUID === 'function') _captureCookieUUID(resp);
      return resp;
    });
  }
  return _origFetch.call(this, url, opts);
};

// --- Config-driven variables (defaults here, overridden by _applyConfig) ---
var LEADERBOARD_LIMIT = 100;
var SCORE_QUEUE_RETRY_MS = 35000;
var SPLASH_DISMISS_RETURNING = 3000;
var SPLASH_DISMISS_NEW = 5000;
var STORE_LINKS = [];
var SHOW_KB_SHORTCUTS = 'auto';
var TIER_ACTIVE = 10;
var TIER_EXPERT = 200;
var TIER_EXPERT_STREAK = 14;
var SKIP_TUTORIAL = false;

// --- App config (loaded from config.json) ---
var _appConfig = { auth: false, blockUnsolved: true, puzzleSet: 11378 };
function _safeMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (var key in source) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (source.hasOwnProperty(key)) target[key] = source[key];
  }
  return target;
}
function _cfg(path, fallback) {
  var parts = path.split('.');
  var v = _appConfig;
  for (var i = 0; i < parts.length; i++) {
    if (v == null) return fallback;
    v = v[parts[i]];
  }
  return v !== undefined ? v : fallback;
}
function _applyConfig() {
  if (_appConfig.workerUrl) {
    WORKER_URL = _appConfig.workerUrl;
    SCORE_API_URL = WORKER_URL + '/score';
    PUZZLE_API = WORKER_URL + '/puzzle/';
    SB_API = WORKER_URL + '/scoreboard';
  }
  if (_appConfig.siteUrl) SITE_URL = _appConfig.siteUrl;
  // Override game constants from config
  ENERGY_MAX = _cfg('energy.max', 5);
  ENERGY_RESTORE_COST = _cfg('energy.restoreCost', 50);
  ENERGY_RECOVERY_PERIOD = _cfg('energy.recoveryHours', 10) * 3600;
  ENERGY_PER_SECOND = ENERGY_MAX / ENERGY_RECOVERY_PERIOD;
  MAX_HINTS = _cfg('hints.maxPerDay', 3);
  HINT_DIAMOND_COST = _cfg('hints.diamondCost', 100);
  UNLOCK_PUZZLE_DIAMOND_COST = _cfg('hints.unlockPuzzleCost', 50);
  EXP_BASE = _cfg('exp', { easy: 100, medium: 250, hard: 750, hell: 2000 });
  PAR_TIMES = _cfg('parTimes', { easy: 60, medium: 90, hard: 120, hell: 180 });
  MULTIPLIER_DURATION_MS = _cfg('multiplier.durationMinutes', 10) * 60000;
  MULTIPLIER_TIME_WINDOWS = _cfg('multiplier.happyHours', [{ start: 12, end: 13 }, { start: 20, end: 21 }]);
  CONSECUTIVE_A_FOR_3X = _cfg('multiplier.consecutiveAForTriple', 3);
  CF_TURNSTILE_SITE_KEY = _cfg('turnstileSiteKey', '0x4AAAAAACuir272GuoMUfnx');
  DAILY_TASK_BONUS = _cfg('dailyTaskBonus', 50);
  MSG_MAX_AGE_MS = _cfg('messageMaxAgeDays', 14) * 24 * 60 * 60 * 1000;
  SB_CACHE_MS = _cfg('scoreboardCacheMs', 180000);
  LEADERBOARD_LIMIT = _cfg('leaderboardLimit', 100);
  SCORE_QUEUE_RETRY_MS = _cfg('scoreQueueRetryMs', 35000);
  SPLASH_DISMISS_RETURNING = _cfg('splashDismissMs.returning', 3000);
  SPLASH_DISMISS_NEW = _cfg('splashDismissMs.new', 5000);
  STORE_LINKS = Array.isArray(_cfg('storeLinks', [])) ? _cfg('storeLinks', []) : [];
  SHOW_KB_SHORTCUTS = _cfg('showKeyboardShortcuts', 'auto');
  var _tiers = _cfg('playerTiers', {});
  if (_tiers && typeof _tiers === 'object') {
    if (Number.isFinite(_tiers.active)) TIER_ACTIVE = _tiers.active;
    if (Number.isFinite(_tiers.expert)) TIER_EXPERT = _tiers.expert;
    if (Number.isFinite(_tiers.expertStreak)) TIER_EXPERT_STREAK = _tiers.expertStreak;
  }
  SKIP_TUTORIAL = !!_cfg('skipTutorial', false);
  if (SKIP_TUTORIAL) localStorage.setItem('octile_tut_step', '9');
  // Pack public key for signature verification
  if (_cfg('pack.publicKey', '')) _setPackPublicKey(_cfg('pack.publicKey', ''));
  // Pure mode: config flag for clean puzzle-only experience
  _isPureMode = !!_cfg('pure', false);
  // Demo mode: Electron + config flag (or window.steam.demo)
  _isDemoMode = _isElectron && (!!_cfg('demo', false) || !!(window.steam && window.steam.demo));
}
var _configReady = new Promise(function(resolve) {
  var url = location.protocol === 'file:' ? 'config.json' : 'config.json?t=' + Date.now();
  // Try fetch first, fall back to XMLHttpRequest for file:// compatibility
  function tryXHR() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'config.json', true);
      xhr.onload = function() {
        try { _safeMerge(_appConfig, JSON.parse(xhr.responseText)); } catch(e) {}
        _applyConfig();
        _configLoaded = true;
        resolve();
      };
      xhr.onerror = function() {
        Object.assign(_appConfig, { pure: true });
        _configLoaded = false;
        _applyConfig();
        resolve();
      };
      xhr.send();
    } catch(e) {
      Object.assign(_appConfig, { pure: true });
      _configLoaded = false;
      _applyConfig();
      resolve();
    }
  }
  try {
    fetch(url).then(function(r) { return r.ok ? r.json() : null; }).then(function(c) {
      if (c) { _safeMerge(_appConfig, c); _applyConfig(); _configLoaded = true; resolve(); }
      else tryXHR();
    }).catch(function() { tryXHR(); });
  } catch(e) { tryXHR(); }
});

// Refresh UI components that depend on config (Daily Challenge card for D1)
_configReady.then(function() {
  // In pure mode, populate _levelTotals from offline defaults now that config is loaded
  if (_isPureMode && typeof _levelTotals !== 'undefined' && typeof _getOfflineTotals === 'function' && !_levelTotals.easy) {
    _levelTotals = {..._getOfflineTotals()};
  }
  if (typeof renderDailyChallengeCard === 'function') renderDailyChallengeCard();
});

var _configLoaded = false; // Boolean flag: true once config is ready

// --- Demo mode (Electron + config flag) ---
var _isDemoMode = false; // set after config loads; true = demo build with limited content
var _isPureMode = false; // set after config loads; true = pure puzzle mode (no meta)
function _noMeta() { return _isElectron || _isPureMode; }
function _isSteam() { return _isElectron; }

function isAuthEnabled() { return !!_appConfig.auth; }
function isBlockUnsolved() { return !!_appConfig.blockUnsolved; }
function getTransforms() { return _appConfig.puzzleSet === 11378 ? 1 : 8; }

// --- Unified feature flags ---
// Each feature can be explicitly enabled/disabled via config.json features block.
// Default: on for normal web, off for pure mode / Electron.
function _feature(name) {
  if (_appConfig.features && typeof _appConfig.features[name] === 'boolean') {
    return _appConfig.features[name];
  }
  return !_noMeta();
}
// Legacy alias — _steamFeature now reads the same unified flags
function _steamFeature(name) { return _feature(name); }

// Helper: Select correct help body translation key based on mode
// Default to non-DC help until config loads (avoid showing DC content prematurely)
function _helpBodyKey() {
  // If config not loaded yet, default to pure Steam help (no DC section)
  if (!_configLoaded && _noMeta()) return 'help_body_steam';

  // After config loads, choose based on mode
  if (_isDemoMode) return 'help_body_steam_demo'; // Demo: special demo help
  if (_isPureMode) {
    // D1: Pure mode with DC enabled → show DC content
    // Pure mode without DC → no DC content
    return _feature('daily_challenge') ? 'help_body_steam' : 'help_body_steam_pure';
  }
  if (_noMeta()) return 'help_body_steam'; // D1: Steam help with DC
  return 'help_body'; // Web: full version with economy
}

var _steamConfigInterval = null;

function _applySteamFlags(data) {
  var f = data && data.steam && data.steam.features;
  if (!f || typeof f !== 'object') return;
  if (!_appConfig.features) _appConfig.features = {};
  for (var k in f) {
    if (f.hasOwnProperty(k) && typeof f[k] === 'boolean') {
      _appConfig.features[k] = f[k];
    }
  }
  _appConfig._steamPhase = (data.steam && data.steam.phase) || null;
  _appConfig._steamConfigStatus = 'ok';
  _appConfig._steamConfigFetchedAt = Date.now();
  // Server-side demo toggle
  if (typeof data.demo === 'boolean') {
    _appConfig.demo = data.demo;
    _isDemoMode = _isElectron && data.demo;
  }
  var ttl = data.steam && data.steam.ttl_seconds;
  if (typeof ttl === 'number' && ttl >= 30 && ttl <= 3600) {
    _appConfig._steamTtl = ttl;
    if (_steamConfigInterval) {
      clearInterval(_steamConfigInterval);
      _steamConfigInterval = setInterval(_fetchSteamConfig, ttl * 1000);
    }
  }
}

function _fetchSteamConfig() {
  return fetch(WORKER_URL + '/config/steam', { signal: AbortSignal.timeout(5000) })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(c) { if (c) _applySteamFlags(c); })
    .catch(function() {
      _appConfig._steamConfigStatus = 'failed';
      _appConfig._steamConfigFetchedAt = Date.now();
    });
}

var _steamConfigReady = _configReady.then(function() {
  if (!_isElectron) return;
  return _fetchSteamConfig().then(function() {
    if (!_steamConfigInterval) {
      var ttl = (_appConfig._steamTtl || 300) * 1000;
      _steamConfigInterval = setInterval(_fetchSteamConfig, ttl);
    }
  });
});

// --- Sound System (Web Audio API synthesis, zero file size) ---
var _soundEnabled = localStorage.getItem('octile_sound') !== '0';
var _audioCtx = null;
function _getAudioCtx() {
  if (!_audioCtx) { try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {} }
  return _audioCtx;
}
function playSound(type) {
  if (!_soundEnabled) return;
  var ctx = _getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  var o = ctx.createOscillator();
  var g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  var t = ctx.currentTime;
  switch (type) {
    case 'place':
      o.frequency.setValueAtTime(440, t);
      o.type = 'sine';
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      o.start(t); o.stop(t + 0.06);
      break;
    case 'rotate':
      o.frequency.setValueAtTime(880, t);
      o.type = 'sine';
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      o.start(t); o.stop(t + 0.03);
      break;
    case 'remove':
      o.frequency.setValueAtTime(330, t);
      o.type = 'sine';
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.start(t); o.stop(t + 0.08);
      break;
    case 'select':
      o.frequency.setValueAtTime(660, t);
      o.type = 'sine';
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      o.start(t); o.stop(t + 0.04);
      break;
    case 'win': {
      // C-E-G arpeggio
      var notes = [523, 659, 784];
      for (var i = 0; i < 3; i++) {
        var oi = ctx.createOscillator();
        var gi = ctx.createGain();
        oi.connect(gi); gi.connect(ctx.destination);
        oi.frequency.setValueAtTime(notes[i], t + i * 0.12);
        oi.type = 'sine';
        gi.gain.setValueAtTime(0.15, t + i * 0.12);
        gi.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.3);
        oi.start(t + i * 0.12); oi.stop(t + i * 0.12 + 0.3);
      }
      return;
    }
    case 'hint':
      o.frequency.setValueAtTime(1200, t);
      o.type = 'sine';
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.start(t); o.stop(t + 0.15);
      break;
    case 'achieve': {
      var o2 = ctx.createOscillator();
      var g2 = ctx.createGain();
      o2.connect(g2); g2.connect(ctx.destination);
      o.frequency.setValueAtTime(523, t); o.type = 'sine';
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.start(t); o.stop(t + 0.15);
      o2.frequency.setValueAtTime(659, t + 0.1); o2.type = 'sine';
      g2.gain.setValueAtTime(0.12, t + 0.1); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o2.start(t + 0.1); o2.stop(t + 0.25);
      return;
    }
    case 'error':
      o.frequency.setValueAtTime(200, t);
      o.type = 'sine';
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o.start(t); o.stop(t + 0.05);
      break;
    case 'toast':
      o.frequency.setValueAtTime(520, t);
      o.type = 'sine';
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.start(t); o.stop(t + 0.08);
      break;
    default: return;
  }
}
function _updateSoundBtn() {
  var btn = document.getElementById('sound-btn');
  if (!btn) return;
  btn.textContent = _soundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
  btn.classList.toggle('muted', !_soundEnabled);
}
function toggleSound() {
  _soundEnabled = !_soundEnabled;
  localStorage.setItem('octile_sound', _soundEnabled ? '1' : '0');
  _updateSoundBtn();
  if (_soundEnabled) playSound('select');
}

// --- Visual Snap Animation ---
function triggerSnap() {
  var cells = document.querySelectorAll('#board .cell.occupied:not(.snap-done)');
  cells.forEach(function(c) {
    if (!c.classList.contains('snap-done')) {
      c.classList.add('snap', 'snap-done');
      setTimeout(function() { c.classList.remove('snap'); }, 200);
    }
  });
}
function triggerBoardPulse() {
  var board = document.getElementById('board');
  board.classList.add('win-pulse');
  setTimeout(function() { board.classList.remove('win-pulse'); }, 400);
}
function spawnFloat(text, cls) {
  var el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  var rect = document.getElementById('exp-display').getBoundingClientRect();
  el.style.left = rect.left + 'px';
  el.style.top = rect.top + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', function() { el.remove(); });
}

// --- Canvas Particle FX Engine ---
var _fxCanvas, _fxCtx, _fxParticles = [], _fxRunning = false;
var _FX_MAX = 400;

function _fxInit() {
  _fxCanvas = document.getElementById('fx-canvas');
  if (!_fxCanvas) return;
  _fxCtx = _fxCanvas.getContext('2d');
  _fxResize();
  window.addEventListener('resize', _fxResize);
}

function _fxResize() {
  if (!_fxCanvas) return;
  var dpr = window.devicePixelRatio || 1;
  _fxCanvas.width = window.innerWidth * dpr;
  _fxCanvas.height = window.innerHeight * dpr;
  _fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function _fxEmit(opts) {
  if (!_fxCtx) return;
  var count = Math.min(opts.count || 10, _FX_MAX - _fxParticles.length);
  for (var i = 0; i < count; i++) {
    var angle = (opts.angle || 0) + (Math.random() - 0.5) * (opts.spread || Math.PI * 2);
    var speed = (opts.speed || 80) * (0.5 + Math.random() * 0.5);
    _fxParticles.push({
      x: opts.x || 0, y: opts.y || 0,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: (opts.life || 1) * (0.7 + Math.random() * 0.3), maxLife: opts.life || 1,
      size: (opts.size || 4) * (0.5 + Math.random() * 0.5),
      color: opts.colors[Math.floor(Math.random() * opts.colors.length)],
      gravity: opts.gravity || 0, type: opts.type || 'circle',
      rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 4
    });
  }
  if (!_fxRunning) { _fxRunning = true; _fxLastTime = performance.now(); requestAnimationFrame(_fxLoop); }
}

var _fxLastTime = 0;
function _fxLoop(now) {
  var dt = Math.min((now - _fxLastTime) / 1000, 0.05);
  _fxLastTime = now;
  _fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (var i = _fxParticles.length - 1; i >= 0; i--) {
    var p = _fxParticles[i];
    p.life -= dt;
    if (p.life <= 0) { _fxParticles.splice(i, 1); continue; }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rotation += p.rotSpeed * dt;
    var alpha = Math.min(1, p.life / (p.maxLife * 0.3));
    _fxCtx.save();
    _fxCtx.globalAlpha = alpha;
    _fxCtx.fillStyle = p.color;
    _fxCtx.translate(p.x, p.y);
    _fxCtx.rotate(p.rotation);
    if (p.type === 'sparkle') {
      _fxDrawStar(_fxCtx, p.size);
    } else if (p.type === 'rect') {
      _fxCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    } else {
      _fxCtx.beginPath();
      _fxCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      _fxCtx.fill();
    }
    _fxCtx.restore();
  }
  if (_fxParticles.length > 0) {
    requestAnimationFrame(_fxLoop);
  } else {
    _fxRunning = false;
  }
}

function _fxDrawStar(ctx, size) {
  ctx.beginPath();
  for (var i = 0; i < 4; i++) {
    var a = (i / 4) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
    var b = a + Math.PI / 4;
    ctx.lineTo(Math.cos(b) * size * 0.35, Math.sin(b) * size * 0.35);
  }
  ctx.closePath();
  ctx.fill();
}

function fxDiamondSparkle(el) {
  if (!_fxCtx || !el) return;
  var r = el.getBoundingClientRect();
  _fxEmit({
    x: r.left + r.width / 2, y: r.top + r.height / 2,
    count: 30, colors: ['#5dade2', '#85c1e9', '#fff', '#aee0ff'],
    speed: 40, life: 2.5, size: 8, gravity: 15,
    spread: Math.PI * 2, type: 'sparkle'
  });
}

function fxGoldBurst(x, y) {
  // Wave 1: big slow sparkles
  _fxEmit({
    x: x, y: y, count: 40,
    colors: ['#f1c40f', '#f9e547', '#fff', '#e67e22', '#ffd700'],
    speed: 60, life: 3, size: 10, gravity: 20,
    spread: Math.PI * 2, type: 'sparkle'
  });
  // Wave 2: medium circles after 400ms
  setTimeout(function() {
    _fxEmit({
      x: x, y: y, count: 25,
      colors: ['#f1c40f', '#fff', '#ffd700'],
      speed: 35, life: 2.5, size: 6, gravity: 12,
      spread: Math.PI * 2, type: 'circle'
    });
  }, 400);
  // Wave 3: lingering tiny sparkles after 800ms
  setTimeout(function() {
    _fxEmit({
      x: x, y: y, count: 15,
      colors: ['#fff', '#f9e547'],
      speed: 20, life: 2, size: 4, gravity: 8,
      spread: Math.PI * 2, type: 'sparkle'
    });
  }, 800);
}

function fxAchieveBurst(el) {
  if (!_fxCtx || !el) return;
  var r = el.getBoundingClientRect();
  _fxEmit({
    x: r.left + r.width / 2, y: r.top + r.height / 2,
    count: 35, colors: ['#f1c40f', '#f0e68c', '#fff', '#ffd700'],
    speed: 45, life: 2.5, size: 8, gravity: 15,
    spread: Math.PI * 2, type: 'sparkle'
  });
}

// --- Haptic Feedback ---
function haptic(pattern) {
  if (!_soundEnabled) return; // tie haptics to sound toggle
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// --- Debug state (declared early, handlers set up later) ---
let _debugForceOffline = false;
let _debugUnlimitedHints = false;
let _debugUnlimitedEnergy = false;
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  try {
    const _dbg = JSON.parse(localStorage.getItem('octile_debug') || '{}');
    _debugForceOffline = !!_dbg.offline;
    _debugUnlimitedHints = !!_dbg.hints;
    _debugUnlimitedEnergy = !!_dbg.energy;
  } catch {}
}
function _saveDebugConfig() {
  try { localStorage.setItem('octile_debug', JSON.stringify({ offline: _debugForceOffline, hints: _debugUnlimitedHints, energy: _debugUnlimitedEnergy })); } catch {}
}

// --- PuzzlePack system: PackReader + IDB storage + download/verify ---

// Base-92 alphabet (same as backend): printable ASCII 33-126, excluding ' (39) and \ (92)
var _PKP92 = '!"#$%&()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~';
var _PKP92_MAP = {};
for (var _pi = 0; _pi < _PKP92.length; _pi++) _PKP92_MAP[_PKP92.charCodeAt(_pi)] = _pi;

// MiniPack v0: embedded pack with 99 base puzzles (792 extended), no ordering, unsigned
var MINIPACK_DATA = 'T1BLMQAAAABjAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApIiErIiEuIiEvIiFiIiFGIiFJIiElIyEmIyFQIiF3IyF6IyEpJCEqJCFXIyFYKCFbKCE4KSE5KSE8XyE/XyFvXiFMXyFOXyFhXyFbYCFAYiEmLCF1LyFSMCFkNyEpcyFsciFHRiFXJiJjTCEzPSIjIiNUSiJhTSJZLCNEVyI4ZCJbZCJ0VyN4OSQtXyMmYyNbPyRyQiRmaSNeaiMwUyQ1IiQwKiRnKyRzSyV9eyRZeyQqVyVRfCQyJSVsWyUtXSVAJiVwJiUyKiVBKiVDbSVhLiVzdCVYKCYlSCVASiVxfi5OYi9aZS9Rby9qcy8udC9FWjBVLjAkMTBNPDAueDBXSDBmUjAxVzA9VzBRITtHJDs9RTp9Rzp2Mzt8QTs7QjsuYzpZZTohQ0UBAQEBAQEBAQEDAQEBAQIBAQEBAQEBAQEBAwMCAgIEAwQEBAICAwICAgICAgIDAgICAgMDBAMBBAMCAgIDAwIDAgMCAwQDBAEDBAQDBAQEBAQDAgQEBAEDBAMEAwQEAwMDBAQ=';

var _miniPackReader = null;
var _fullPackReader = null;
var _packReady = null; // Promise, resolves when IDB pack loaded (or immediately if none)

var PUZZLE_COUNT_BASE = 11378;

// --- PackReader class ---

function PackReader(buffer) {
  var view = new DataView(buffer);
  // Validate magic
  var magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'OPK1') throw new Error('Invalid pack magic: ' + magic);

  this.version = view.getUint32(4, true);
  this.puzzleCount = view.getUint32(8, true);
  this.schema = view.getUint16(12, true);
  this.hasOrdering = !!(view.getUint8(14) & 1);
  this.signature = new Uint8Array(buffer, 16, 64);

  var dataStart = 80;
  this._puzzleData = new Uint8Array(buffer, dataStart, this.puzzleCount * 3);
  this._diffLevels = new Uint8Array(buffer, dataStart + this.puzzleCount * 3, this.puzzleCount);
  this._buffer = buffer;

  // Parse ordering if present
  this._levelCounts = null;  // [easy, medium, hard, hell]
  this._levelOrdering = null; // {1: Uint16Array, 2: ..., 3: ..., 4: ...}
  if (this.hasOrdering) {
    var ordStart = dataStart + this.puzzleCount * 4; // after puzzle data + diff levels
    var ov = new DataView(buffer, ordStart);
    this._levelCounts = [
      ov.getUint16(0, true), ov.getUint16(2, true),
      ov.getUint16(4, true), ov.getUint16(6, true)
    ];
    this._levelOrdering = {};
    var offset = 8;
    for (var li = 1; li <= 4; li++) {
      var count = this._levelCounts[li - 1];
      var arr = new Uint16Array(count);
      for (var j = 0; j < count; j++) {
        arr[j] = ov.getUint16(offset, true);
        offset += 2;
      }
      this._levelOrdering[li] = arr;
    }
  }

  // Build base-index set for canDecode
  this._baseIndices = null; // lazy: only for MiniPack (when puzzleCount < PUZZLE_COUNT_BASE)
  if (this.puzzleCount < PUZZLE_COUNT_BASE) {
    // MiniPack: need a mapping from actual base indices to position in pack
    // The pack stores puzzles in order of their base indices (sorted)
    // We need to reconstruct which base indices are in the pack
    // For MiniPack, the base indices are stored in minipack-v0-mapping.json at build time
    // But at runtime we don't have that. Instead, we'll decode and match.
    // Actually, the MiniPack stores puzzles at positions 0..N-1 which correspond to
    // specific base indices. We need a reverse lookup.
    // For now, we'll build it from the embedded mapping approach:
    // The pack itself doesn't store which base indices it contains.
    // We need to store this information. Let's use the difficulty levels as a fingerprint.
    // Actually, per the plan, the MiniPack just contains base puzzles at sequential positions.
    // The position in the pack IS the lookup key. We need external mapping.
    // Let's handle this differently: store the base index mapping in the pack.
    // But the format doesn't have it. So for MiniPack, we'll build a decode-all-and-match approach.
    // OR: we just expose decodePuzzle(position) where position = index in pack.
    // The getPuzzleCells will need to try all transforms to find the right base.
    //
    // Simpler approach: build base index list from the mapping JSON embedded at build time.
    // For MiniPack, we embed the list alongside the base64 data.
    this._baseIndices = null; // will be set by _initMiniPack
  }
}

// Decode puzzle at pack-local index (0-based position in this pack's data)
PackReader.prototype.decodePuzzle = function(packIndex) {
  if (packIndex < 0 || packIndex >= this.puzzleCount) return null;
  var o = packIndex * 3;
  var d = this._puzzleData;
  var n = _PKP92_MAP[d[o]] + _PKP92_MAP[d[o + 1]] * 92 + _PKP92_MAP[d[o + 2]] * 92 * 92;

  var g3_idx = n % 96;
  var g2_idx = Math.floor(n / 96) % 112;
  var g1 = Math.floor(n / 10752);

  // Decode grey2
  var g2a, g2b;
  if (g2_idx < 56) {
    var r2 = Math.floor(g2_idx / 7), c2 = g2_idx % 7;
    g2a = r2 * 8 + c2;
    g2b = g2a + 1;
  } else {
    var i2 = g2_idx - 56;
    var r2v = Math.floor(i2 / 8), c2v = i2 % 8;
    g2a = r2v * 8 + c2v;
    g2b = g2a + 8;
  }

  // Decode grey3
  var g3a, g3b, g3c;
  if (g3_idx < 48) {
    var r3 = Math.floor(g3_idx / 6), c3 = g3_idx % 6;
    g3a = r3 * 8 + c3;
    g3b = g3a + 1;
    g3c = g3a + 2;
  } else {
    var i3 = g3_idx - 48;
    var r3v = Math.floor(i3 / 8), c3v = i3 % 8;
    g3a = r3v * 8 + c3v;
    g3b = g3a + 8;
    g3c = g3a + 16;
  }

  return [g1, g2a, g2b, g3a, g3b, g3c];
};

// D4 symmetry transform on 8x8 board cell
PackReader.prototype.transformCell = function(cell, transform) {
  var r = Math.floor(cell / 8), c = cell % 8;
  switch (transform) {
    case 1: var t = r; r = c; c = 7 - t; break;
    case 2: r = 7 - r; c = 7 - c; break;
    case 3: var t3 = r; r = 7 - c; c = t3; break;
    case 4: c = 7 - c; break;
    case 5: var t5 = r; r = 7 - c; c = 7 - t5; break;
    case 6: r = 7 - r; break;
    case 7: var t7 = r; r = c; c = t7; break;
  }
  return r * 8 + c;
};

// Decompose extended puzzle number (1-based) into [baseIndex, transform]
PackReader.prototype.decompose = function(puzzleNumber) {
  var idx = puzzleNumber - 1;
  var transform = Math.floor(idx / PUZZLE_COUNT_BASE);
  var base = idx % PUZZLE_COUNT_BASE;
  return [base, transform];
};

// Get cells for an extended puzzle number (1-based). Returns [6 cells] or null.
PackReader.prototype.getPuzzleCells = function(puzzleNumber) {
  var parts = this.decompose(puzzleNumber);
  var baseIndex = parts[0], transform = parts[1];

  // For FullPack (puzzleCount == PUZZLE_COUNT_BASE): packIndex == baseIndex
  // For MiniPack: need to look up baseIndex in _baseIndices
  var packIndex;
  if (this.puzzleCount === PUZZLE_COUNT_BASE) {
    packIndex = baseIndex;
  } else if (this._baseIndices) {
    packIndex = this._baseIndices.indexOf(baseIndex);
    if (packIndex === -1) return null;
  } else {
    return null;
  }

  var cells = this.decodePuzzle(packIndex);
  if (!cells) return null;
  if (transform === 0) return cells;
  var self = this;
  return cells.map(function(c) { return self.transformCell(c, transform); });
};

// Check if this pack can decode a given extended puzzle number
PackReader.prototype.canDecode = function(puzzleNumber) {
  var baseIndex = this.decompose(puzzleNumber)[0];
  if (this.puzzleCount === PUZZLE_COUNT_BASE) return baseIndex < this.puzzleCount;
  if (this._baseIndices) return this._baseIndices.indexOf(baseIndex) !== -1;
  return false;
};

// Level slot → puzzle number (FullPack only, interleaved ordering)
PackReader.prototype.levelSlotToPuzzle = function(level, slot) {
  if (!this.hasOrdering || !this._levelOrdering) return null;
  var levelNum = {easy: 1, medium: 2, hard: 3, hell: 4}[level];
  if (!levelNum) return null;
  var bases = this._levelOrdering[levelNum];
  if (!bases) return null;
  var numBases = bases.length;
  var total = numBases * 8;
  if (slot < 1 || slot > total) return null;
  var slot0 = slot - 1;
  var basePos = slot0 % numBases;
  var transform = Math.floor(slot0 / numBases);
  var baseIdx = bases[basePos];
  return transform * PUZZLE_COUNT_BASE + baseIdx + 1;
};

// Get total puzzles in a level (FullPack only)
PackReader.prototype.getLevelTotal = function(level) {
  if (!this.hasOrdering || !this._levelOrdering) return 0;
  var levelNum = {easy: 1, medium: 2, hard: 3, hell: 4}[level];
  if (!levelNum) return 0;
  var bases = this._levelOrdering[levelNum];
  if (!bases) return 0;
  // Respect transforms setting: multiply by 8 for full set (91024), by 1 for base set (11378)
  var multiplier = (typeof getTransforms === 'function') ? getTransforms() : 8;
  return bases.length * multiplier;
};

// Get all level totals as {easy:N, medium:N, hard:N, hell:N}
PackReader.prototype.getAllLevelTotals = function() {
  var totals = {};
  var levels = ['easy', 'medium', 'hard', 'hell'];
  for (var i = 0; i < levels.length; i++) {
    totals[levels[i]] = this.getLevelTotal(levels[i]);
  }
  return totals;
};

// Get list of all base indices in this pack (for random selection in MiniPack)
PackReader.prototype.getBaseIndices = function() {
  if (this._baseIndices) return this._baseIndices;
  if (this.puzzleCount === PUZZLE_COUNT_BASE) return null; // too many to list
  return null;
};

// Get a random puzzle number from this pack
PackReader.prototype.getRandomPuzzleNumber = function() {
  if (this.puzzleCount === PUZZLE_COUNT_BASE) {
    return Math.floor(Math.random() * PUZZLE_COUNT_BASE * 8) + 1;
  }
  if (this._baseIndices) {
    var base = this._baseIndices[Math.floor(Math.random() * this._baseIndices.length)];
    var transform = Math.floor(Math.random() * 8);
    return transform * PUZZLE_COUNT_BASE + base + 1;
  }
  return 1;
};

// --- MiniPack initialization ---

// Base indices embedded from generate-minipack.py (sorted)
var MINIPACK_BASE_INDICES = [0,1,2,4,9,10,14,15,57,60,64,65,72,86,88,93,94,98,231,234,238,239,278,281,289,294,296,308,333,382,557,667,670,952,1016,1034,1539,1561,1683,1877,2068,2099,2122,2167,2231,2449,2461,2748,2873,2919,2974,3053,3103,3205,3222,3530,3970,4137,4345,4602,4751,4765,4771,4904,4960,4984,5012,5141,5171,5196,5199,5440,5462,5698,6206,6358,6412,6633,6673,6730,6837,6860,6867,7089,7224,7240,7497,7575,7899,8274,8358,8363,9230,9309,9331,9388,9860,10316,10512,10540];

function _initMiniPack() {
  try {
    var raw = atob(MINIPACK_DATA);
    var buf = new ArrayBuffer(raw.length);
    var view = new Uint8Array(buf);
    for (var i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
    _miniPackReader = new PackReader(buf);
    _miniPackReader._baseIndices = MINIPACK_BASE_INDICES;
  } catch (e) {
    console.error('[Octile] MiniPack init failed:', e);
  }
}

// Initialize MiniPack immediately
_initMiniPack();

// --- IndexedDB storage ---

var _IDB_NAME = 'octile_packs';
var _IDB_VERSION = 1;

function _openPackDB() {
  return new Promise(function(resolve, reject) {
    if (typeof indexedDB === 'undefined') { reject(new Error('no IDB')); return; }
    var req = indexedDB.open(_IDB_NAME, _IDB_VERSION);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('packs')) db.createObjectStore('packs');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
  });
}

function _idbGet(storeName, key) {
  return _openPackDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(storeName, 'readonly');
      var req = tx.objectStore(storeName).get(key);
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

function _idbPut(storeName, key, value) {
  return _openPackDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(storeName, 'readwrite');
      var req = tx.objectStore(storeName).put(value, key);
      req.onsuccess = function() { resolve(); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

// --- Pack loading from IDB ---

function _loadPackFromIDB() {
  return _idbGet('packs', 'active').then(function(record) {
    if (!record || !record.data) return false;
    try {
      var reader = new PackReader(record.data);
      // Verify signature if FullPack
      if (reader.puzzleCount === PUZZLE_COUNT_BASE) {
        if (!_verifyPackSignature(reader)) {
          console.warn('[Octile] Pack signature invalid, discarding');
          return false;
        }
      }
      _fullPackReader = reader;
      console.log('[Octile] Loaded FullPack v' + reader.version + ' from IDB (' + reader.puzzleCount + ' puzzles)');
      // Notify UI that FullPack is ready
      document.dispatchEvent(new Event('fullpack-ready'));
      return true;
    } catch (e) {
      console.warn('[Octile] Failed to load pack from IDB:', e);
      return false;
    }
  }).catch(function() { return false; });
}

// --- Signature verification ---

var _PACK_PUBLIC_KEY = null; // set from config

function _setPackPublicKey(b64) {
  if (!b64) return;
  try {
    var raw = atob(b64);
    _PACK_PUBLIC_KEY = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) _PACK_PUBLIC_KEY[i] = raw.charCodeAt(i);
  } catch (e) {
    console.warn('[Octile] Invalid pack public key');
  }
}

function _verifyPackSignature(reader) {
  if (!_PACK_PUBLIC_KEY || typeof nacl === 'undefined') return true; // skip if no key or no nacl
  try {
    var dataPayload = new Uint8Array(reader._buffer, 80);
    var sig = reader.signature;
    return nacl.sign.detached.verify(dataPayload, sig, _PACK_PUBLIC_KEY);
  } catch (e) {
    console.warn('[Octile] Signature verification error:', e);
    return false;
  }
}

function _verifyReleaseSignature(currentObj, sigB64) {
  if (!_PACK_PUBLIC_KEY || typeof nacl === 'undefined') return true;
  try {
    var canonical = JSON.stringify(currentObj, Object.keys(currentObj).sort(), 0)
      .replace(/\s/g, '');
    // Use proper canonical: sorted keys, no spaces
    var keys = Object.keys(currentObj).sort();
    var obj = {};
    for (var i = 0; i < keys.length; i++) obj[keys[i]] = currentObj[keys[i]];
    canonical = JSON.stringify(obj);
    var msgBytes = new TextEncoder().encode(canonical);
    var sigRaw = atob(sigB64);
    var sigBytes = new Uint8Array(sigRaw.length);
    for (var j = 0; j < sigRaw.length; j++) sigBytes[j] = sigRaw.charCodeAt(j);
    return nacl.sign.detached.verify(msgBytes, sigBytes, _PACK_PUBLIC_KEY);
  } catch (e) {
    console.warn('[Octile] Release signature verification error:', e);
    return false;
  }
}

// --- Download & update ---

function checkPackUpdate() {
  var releaseUrl = _cfg('pack.releaseUrl', '');
  if (!releaseUrl) return Promise.resolve();

  return fetch(releaseUrl, { signal: AbortSignal.timeout(10000), cache: 'no-cache' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(release) {
      if (!release || !release.current) return;
      var current = release.current;

      // Check version
      var localVersion = _fullPackReader ? _fullPackReader.version : 0;
      if (current.version <= localVersion) return;

      // Check minimum app version
      if (current.minAppVersionCode && current.minAppVersionCode > APP_VERSION_CODE) return;

      // Verify release signature
      if (release.signature && !_verifyReleaseSignature(current, release.signature)) {
        console.warn('[Octile] Release manifest signature invalid');
        return;
      }

      // Download pack
      return _downloadPack(current);
    })
    .catch(function(e) {
      console.log('[Octile] Pack update check failed:', e.message);
    });
}

function _fetchWithMirrors(urls) {
  var i = 0;
  function tryNext() {
    if (i >= urls.length) return Promise.resolve(null);
    var url = urls[i++];
    return fetch(url, { signal: AbortSignal.timeout(30000) })
      .then(function(r) { return r.ok ? r.arrayBuffer() : null; })
      .then(function(buf) {
        if (buf) return buf;
        return tryNext();
      })
      .catch(function() { return tryNext(); });
  }
  return tryNext();
}

function _downloadPack(info) {
  var urls = [info.url];
  if (info.mirrors && info.mirrors.length) urls = urls.concat(info.mirrors);

  return _fetchWithMirrors(urls).then(function(buf) {
    if (!buf) return;

    // Verify SHA-256
    return crypto.subtle.digest('SHA-256', buf).then(function(hashBuf) {
      var hashArr = new Uint8Array(hashBuf);
      var hex = '';
      for (var i = 0; i < hashArr.length; i++) hex += ('0' + hashArr[i].toString(16)).slice(-2);

      if (hex !== info.sha256) {
        console.warn('[Octile] Pack SHA-256 mismatch');
        return;
      }

      // Parse and verify signature
      var reader;
      try { reader = new PackReader(buf); } catch (e) {
        console.warn('[Octile] Downloaded pack parse failed:', e);
        return;
      }

      if (!_verifyPackSignature(reader)) {
        console.warn('[Octile] Downloaded pack signature invalid');
        return;
      }

      // Store in IDB and activate
      _fullPackReader = reader;
      console.log('[Octile] Installed FullPack v' + reader.version + ' (' + reader.puzzleCount + ' puzzles)');
      // Notify UI that FullPack is ready
      document.dispatchEvent(new Event('fullpack-ready'));

      return _idbPut('packs', 'active', {
        version: reader.version,
        data: buf,
        installedAt: Date.now()
      }).catch(function() {}); // IDB write failure is non-fatal
    });
  });
}

// Compute ordering_id: first 8 hex of SHA-256 of canonical ordering bytes
PackReader.prototype.getOrderingId = function() {
  if (this._orderingId) return Promise.resolve(this._orderingId);
  if (!this.hasOrdering) return Promise.resolve(null);
  var dataStart = 80 + this.puzzleCount * 4; // after header + puzzleData + diffLevels
  var orderingBytes = new Uint8Array(this._buffer, dataStart);
  var self = this;
  return crypto.subtle.digest('SHA-256', orderingBytes).then(function(hash) {
    var arr = new Uint8Array(hash);
    var hex = '';
    for (var i = 0; i < 4; i++) hex += ('0' + arr[i].toString(16)).slice(-2);
    self._orderingId = hex;
    return hex;
  });
};

// --- Public API ---

function hasFullPuzzleSet() {
  return !!_fullPackReader;
}

var _orderingMismatchLogged = false;

function _checkOrderingMismatch() {
  if (_orderingMismatchLogged) return;
  if (!_fullPackReader || !_fullPackReader.hasOrdering || !_serverOrderingId) return;
  _fullPackReader.getOrderingId().then(function(packId) {
    if (packId && packId !== _serverOrderingId) {
      console.warn('[Octile] Ordering mismatch: pack=' + packId + ' server=' + _serverOrderingId);
      _orderingMismatchLogged = true;
    }
  });
}

function _initPacks() {
  // Set public key from config
  _setPackPublicKey(_cfg('pack.publicKey', ''));

  // Load from IDB, then check for updates
  _packReady = _loadPackFromIDB().then(function() {
    _checkOrderingMismatch();
    // Background update check (non-blocking)
    checkPackUpdate();
  }).catch(function() {});

  return _packReady;
}
// --- Cloudflare Turnstile (invisible, loaded only on valid web origins) ---
var CF_TURNSTILE_SITE_KEY = '0x4AAAAAACuir272GuoMUfnx';  // overridden by config.json turnstileSiteKey
let _turnstileToken = null;
let _turnstileReady = false;

function _shouldLoadTurnstile() {
  if (!CF_TURNSTILE_SITE_KEY || !WORKER_URL) return false;
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return false;
  // Turnstile only works on http/https origins, not file:// (WebView apps)
  return location.protocol === 'https:' || location.protocol === 'http:';
}

function _loadTurnstileScript() {
  if (!_shouldLoadTurnstile()) return;
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=_onTurnstileLoad&render=explicit';
  script.async = true;
  document.head.appendChild(script);
}

function _onTurnstileLoad() {
  if (typeof turnstile === 'undefined') return;
  turnstile.render('#cf-turnstile', {
    sitekey: CF_TURNSTILE_SITE_KEY,
    size: 'compact',
    callback: (token) => { _turnstileToken = token; _turnstileReady = true; },
    'error-callback': (errorCode) => {
      console.warn('[Octile] Turnstile challenge failed:', errorCode);
      _turnstileReady = false;
      // 110xxx = config error (domain not authorized) — stop retrying
      if (typeof errorCode === 'string' && errorCode.startsWith('110')) {
        if (typeof turnstile !== 'undefined') turnstile.remove('#cf-turnstile');
      }
    },
    'refresh-expired': 'auto',
  });
}

function getTurnstileToken() {
  if (!_shouldLoadTurnstile()) return null;
  if (!_turnstileReady) return null;
  const token = _turnstileToken;
  _turnstileToken = null;
  _turnstileReady = false;
  if (typeof turnstile !== 'undefined') turnstile.reset('#cf-turnstile');
  return token;
}

// Load Turnstile after page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _loadTurnstileScript);
} else {
  _loadTurnstileScript();
}

// --- In-app update check (native apps only, not web) ---
function checkForUpdate() {
  // Only check for updates in native app context (file:// protocol).
  // On the web (https://), the page itself IS the latest version.
  if (location.protocol !== 'file:') return;
  fetch(SITE_URL + 'version.json?t=' + Date.now())
    .then(r => r.ok ? r.json() : null)
    .catch(() => null)
    .then(data => {
      if (!data) return;
      var url = data.playStoreUrl || data.apkUrl;

      // --- Force update check (non-dismissible blocker) ---
      var minVer = data.minVersionCode || 0;
      if (minVer > APP_VERSION_CODE) {
        // Check grace period
        var enforce = !data.enforceAfter || new Date(data.enforceAfter) <= new Date();
        if (enforce) {
          document.getElementById('update-text').textContent = t('update_required');
          document.getElementById('update-btn').textContent = t('update_now');
          document.getElementById('update-btn').onclick = () => { if (url) window.open(url, '_blank'); };
          document.getElementById('update-dismiss').style.display = 'none';
          document.getElementById('update-banner').classList.add('show', 'force');
          // Block back button dismiss
          document.getElementById('update-banner').onclick = function(e) { e.stopPropagation(); };
          return; // Don't show normal banner on top of force update
        }
      }

      // --- Normal update banner (dismissible) ---
      var storeVersion = data.playStoreVersionCode || data.versionCode;
      if (storeVersion <= APP_VERSION_CODE) return;
      var dismissed = localStorage.getItem('update_dismissed_v' + storeVersion);
      if (dismissed) return;
      var lang = currentLang || 'en';
      var notes = (data.releaseNotes && data.releaseNotes[lang]) || data.releaseNotes?.en || '';
      document.getElementById('update-text').textContent = t('update_available') + (notes ? ' — ' + notes : '');
      document.getElementById('update-btn').textContent = t('update_btn');
      document.getElementById('update-dismiss').textContent = t('update_later');
      document.getElementById('update-dismiss').style.display = '';
      document.getElementById('update-btn').onclick = () => { if (url) window.open(url, '_blank'); };
      document.getElementById('update-dismiss').onclick = () => {
        document.getElementById('update-banner').classList.remove('show');
        localStorage.setItem('update_dismissed_v' + storeVersion, '1');
      };
      document.getElementById('update-banner').classList.add('show');
    });
}
setTimeout(checkForUpdate, 3000);

// --- OTA update ready (called by native Android after background download) ---
window.onOtaUpdateReady = function(version) {
  var banner = document.getElementById('update-banner');
  document.getElementById('update-text').textContent = t('ota_ready');
  document.getElementById('update-btn').textContent = t('ota_restart');
  document.getElementById('update-btn').onclick = function() { location.reload(); };
  document.getElementById('update-dismiss').textContent = t('update_later');
  document.getElementById('update-dismiss').onclick = function() {
    banner.classList.remove('show');
  };
  banner.classList.add('show');
};

function getBrowserUUID() {
  // Electron: always use local browser UUID for stable identity (no cookie drift)
  if (_isElectron) {
    let uuid = localStorage.getItem('octile_browser_uuid');
    if (!uuid) {
      uuid = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
      localStorage.setItem('octile_browser_uuid', uuid);
    }
    return uuid;
  }
  // Prefer Worker-issued cookie UUID (set via X-Cookie-UUID response header)
  let uuid = localStorage.getItem('octile_cookie_uuid');
  if (uuid) return uuid;
  // Fallback to legacy client-generated UUID
  uuid = localStorage.getItem('octile_browser_uuid');
  if (!uuid) {
    uuid = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    localStorage.setItem('octile_browser_uuid', uuid);
  }
  return uuid;
}

// Capture cookie UUID from Worker response headers (called after first API response)
function _captureCookieUUID(response) {
  if (!response || !response.headers) return response;
  const cookieUUID = response.headers.get('X-Cookie-UUID');
  if (cookieUUID && cookieUUID !== localStorage.getItem('octile_cookie_uuid')) {
    localStorage.setItem('octile_cookie_uuid', cookieUUID);
  }
  return response;
}

// Compact 2-char piece ID for solution encoding
// Compact solution: 8 base-92 chars (mixed-radix: position+direction per piece)
const _P92 = [];
for (let i = 33; i < 127; i++) { if (i !== 39 && i !== 92) _P92.push(String.fromCharCode(i)); }
const _ENC = [
  { id:'red1',  r:2,c:3,sq:0 }, { id:'red2',  r:1,c:4,sq:0 },
  { id:'white1',r:1,c:5,sq:0 }, { id:'white2',r:2,c:2,sq:1 },
  { id:'blue1', r:2,c:5,sq:0 }, { id:'blue2', r:3,c:4,sq:0 },
  { id:'yel1',  r:3,c:3,sq:1 }, { id:'yel2',  r:2,c:4,sq:0 },
];
for (const p of _ENC) { p.hN = (9-p.r)*(9-p.c); p.N = p.sq ? p.hN : p.hN*2; }

function encodeSolution() {
  const bounds = {};
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const id = board[r][c]; if (!bounds[id]) bounds[id] = [r,c,r,c];
    else { if (r < bounds[id][0]) bounds[id][0]=r; if (c < bounds[id][1]) bounds[id][1]=c;
           if (r > bounds[id][2]) bounds[id][2]=r; if (c > bounds[id][3]) bounds[id][3]=c; }
  }
  let n = 0;
  for (let i = 7; i >= 0; i--) {
    const p = _ENC[i], b = bounds[p.id], h = b[2]-b[0]+1;
    let pi;
    if (p.sq || h === p.r) pi = b[0]*(9-p.c) + b[1];
    else pi = p.hN + b[0]*(9-p.r) + b[1];
    n = n * p.N + pi;
  }
  let s = '';
  for (let i = 0; i < 8; i++) { s += _P92[n % 92]; n = Math.floor(n / 92); }
  return s;
}

// --- Move log: record each placement for anti-cheat ---
// Encoding: tile(0-7) × 128 + direction(0-1) × 64 + position(0-63) = 0-1023
// Each move → 2 base-92 chars (92² = 8464 > 1024)
const _TILE_IDX = {};
for (let i = 0; i < _ENC.length; i++) _TILE_IDX[_ENC[i].id] = i;

function recordMove(pieceId, shape, row, col) {
  const ti = _TILE_IDX[pieceId];
  if (ti === undefined) return; // grey pieces, ignore
  const dir = (!_ENC[ti].sq && shape.length > shape[0].length) ? 1 : 0;
  const pos = row * 8 + col;
  _moveLog.push(ti * 128 + dir * 64 + pos);
  _placementOrder.push(pieceId);
}

function encodeMoveLog() {
  // Strip last 4 placements — once 4 pieces are correctly placed, the rest is trivial.
  // The final board state is already in `solution`, so the tail is redundant.
  const log = _moveLog.length > 4 ? _moveLog.slice(0, _moveLog.length - 4) : _moveLog;
  let s = '';
  for (let i = 0; i < log.length; i++) {
    const v = log[i];
    s += _P92[v % 92] + _P92[Math.floor(v / 92)];
  }
  return s;
}

// --- Offline score queue ---
const SCORE_QUEUE_KEY = 'octile_score_queue';

function getScoreQueue() {
  try { return JSON.parse(localStorage.getItem(SCORE_QUEUE_KEY)) || []; }
  catch { return []; }
}

function saveScoreQueue(queue) {
  localStorage.setItem(SCORE_QUEUE_KEY, JSON.stringify(queue));
}

async function sendOneScore(entry) {
  const url = SCORE_API_URL;
  var headers = { 'Content-Type': 'application/json' };
  if (isAuthenticated()) {
    var token = localStorage.getItem('octile_auth_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(entry),
  });
  if (res.status === 409) {
    // Puzzle data version mismatch — refresh data_version
    try {
      var data = await res.json();
      if (data.current_version) _serverDataVersion = data.current_version;
    } catch(e) {}
    console.warn('[Octile] Score rejected: puzzle data outdated, refreshing');
    return; // don't throw — score is lost but game continues
  }
  if (!res.ok) throw new Error('HTTP ' + res.status);
}

let _flushTimer = null;
async function flushScoreQueue() {
  const queue = getScoreQueue();
  if (!queue.length) return;
  // Send one entry at a time; schedule next after rate-limit window
  const entry = queue[0];
  try {
    await sendOneScore(entry);
    saveScoreQueue(queue.slice(1));
    // Schedule next queued entry after 35s (past 30s rate limit)
    if (queue.length > 1 && !_flushTimer) {
      _flushTimer = setTimeout(() => { _flushTimer = null; flushScoreQueue(); }, SCORE_QUEUE_RETRY_MS);
    }
  } catch {
    // Failed — retry later (on next solve or online event)
  }
}

async function submitScore(puzzleNumber, resolveTime) {
  const moves = encodeMoveLog();
  const entry = {
    puzzle_number: puzzleNumber,
    resolve_time: resolveTime,
    browser_uuid: getBrowserUUID(),
    solution: encodeSolution(),
    moves: moves || undefined,
    timestamp_utc: new Date().toISOString(), // legacy: keeps compat with old server
  };
  if (_serverDataVersion) entry.data_version = _serverDataVersion;
  if (_isDailyChallenge) { entry.daily_challenge = true; entry.daily_date = _dailyDate; }
  // Attach Turnstile token when Worker proxy is configured
  const cfToken = getTurnstileToken();
  if (cfToken) entry.cf_turnstile_token = cfToken;
  if (!isOnline()) {
    const queue = getScoreQueue();
    queue.push(entry);
    saveScoreQueue(queue);
    console.info('[Octile] Offline — score queued for later');
    return;
  }
  try {
    await sendOneScore(entry);
    // Check if we're #1 on this puzzle's scoreboard (background, non-blocking)
    checkRank1(puzzleNumber);
    // Flush queued scores after rate-limit window
    if (!_flushTimer) {
      _flushTimer = setTimeout(() => { _flushTimer = null; flushScoreQueue(); }, SCORE_QUEUE_RETRY_MS);
    }
  } catch (e) {
    console.warn('[Octile] Score submission failed, queuing:', e.message);
    const queue = getScoreQueue();
    queue.push(entry);
    saveScoreQueue(queue);
  }
}

async function checkRank1(puzzleNumber) {
  try {
    const data = await sbFetch({ puzzle: String(puzzleNumber), best: 'true', limit: '1' });
    if (data.scores && data.scores.length && data.scores[0].browser_uuid === getBrowserUUID()) {
      const unlocked = getUnlockedAchievements();
      if (!unlocked['rank_1']) {
        unlocked['rank_1'] = Date.now();
        saveUnlockedAchievements(unlocked);
        const ach = ACHIEVEMENTS.find(a => a.id === 'rank_1');
        if (ach) showAchieveToast(ach);
      }
    }
  } catch {}
}

// Re-check backend on network change
window.addEventListener('online', () => {
  _kickHealthCheck(true);
  flushScoreQueue();
});
window.addEventListener('offline', () => {
  _backendOnline = false;
  updateOnlineUI();
});

// --- Avatar & Cute Name System ---
function hashUUID(uuid) {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) {
    h = ((h << 5) - h + uuid.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function generateAvatar(uuid, size) {
  size = size || 64;
  const h = hashUUID(uuid);
  const bgColors = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#34495e','#e91e63','#00bcd4','#8bc34a','#ff5722'];
  const bg = bgColors[h % bgColors.length];
  const faceY = size * 0.42;
  const r = size * 0.38;
  // Eyes
  const eyeType = (h >> 4) % 5;
  const eyeL = size * 0.35;
  const eyeR = size * 0.65;
  const eyeY = faceY - r * 0.1;
  let eyes = '';
  if (eyeType === 0) { // dots
    eyes = `<circle cx="${eyeL}" cy="${eyeY}" r="${size*0.045}" fill="#fff"/><circle cx="${eyeR}" cy="${eyeY}" r="${size*0.045}" fill="#fff"/>`;
  } else if (eyeType === 1) { // big round
    eyes = `<circle cx="${eyeL}" cy="${eyeY}" r="${size*0.065}" fill="#fff"/><circle cx="${eyeR}" cy="${eyeY}" r="${size*0.065}" fill="#fff"/><circle cx="${eyeL+size*0.015}" cy="${eyeY-size*0.01}" r="${size*0.03}" fill="#333"/><circle cx="${eyeR+size*0.015}" cy="${eyeY-size*0.01}" r="${size*0.03}" fill="#333"/>`;
  } else if (eyeType === 2) { // happy (arcs)
    eyes = `<path d="M${eyeL-size*0.05} ${eyeY} Q${eyeL} ${eyeY-size*0.07} ${eyeL+size*0.05} ${eyeY}" stroke="#fff" stroke-width="${size*0.03}" fill="none" stroke-linecap="round"/><path d="M${eyeR-size*0.05} ${eyeY} Q${eyeR} ${eyeY-size*0.07} ${eyeR+size*0.05} ${eyeY}" stroke="#fff" stroke-width="${size*0.03}" fill="none" stroke-linecap="round"/>`;
  } else if (eyeType === 3) { // wink
    eyes = `<circle cx="${eyeL}" cy="${eyeY}" r="${size*0.05}" fill="#fff"/><path d="M${eyeR-size*0.05} ${eyeY} Q${eyeR} ${eyeY-size*0.06} ${eyeR+size*0.05} ${eyeY}" stroke="#fff" stroke-width="${size*0.03}" fill="none" stroke-linecap="round"/>`;
  } else { // star eyes
    eyes = `<text x="${eyeL}" y="${eyeY+size*0.02}" text-anchor="middle" font-size="${size*0.12}" fill="#fff">★</text><text x="${eyeR}" y="${eyeY+size*0.02}" text-anchor="middle" font-size="${size*0.12}" fill="#fff">★</text>`;
  }
  // Mouth
  const mouthType = (h >> 8) % 5;
  const mouthY = faceY + r * 0.35;
  let mouth = '';
  if (mouthType === 0) { // smile
    mouth = `<path d="M${size*0.38} ${mouthY} Q${size*0.5} ${mouthY+size*0.1} ${size*0.62} ${mouthY}" stroke="#fff" stroke-width="${size*0.025}" fill="none" stroke-linecap="round"/>`;
  } else if (mouthType === 1) { // big grin
    mouth = `<path d="M${size*0.35} ${mouthY} Q${size*0.5} ${mouthY+size*0.15} ${size*0.65} ${mouthY}" stroke="#fff" stroke-width="${size*0.025}" fill="rgba(255,255,255,0.2)" stroke-linecap="round"/>`;
  } else if (mouthType === 2) { // O mouth
    mouth = `<circle cx="${size*0.5}" cy="${mouthY+size*0.02}" rx="${size*0.05}" ry="${size*0.06}" fill="rgba(255,255,255,0.25)" stroke="#fff" stroke-width="${size*0.02}"/>`;
  } else if (mouthType === 3) { // cat mouth
    mouth = `<path d="M${size*0.42} ${mouthY} L${size*0.5} ${mouthY+size*0.06} L${size*0.58} ${mouthY}" stroke="#fff" stroke-width="${size*0.02}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else { // flat
    mouth = `<line x1="${size*0.4}" y1="${mouthY}" x2="${size*0.6}" y2="${mouthY}" stroke="#fff" stroke-width="${size*0.025}" stroke-linecap="round"/>`;
  }
  // Accessory
  const accType = (h >> 12) % 7;
  let acc = '';
  if (accType === 1) { // blush
    acc = `<circle cx="${eyeL-size*0.02}" cy="${eyeY+size*0.1}" r="${size*0.05}" fill="rgba(255,150,150,0.35)"/><circle cx="${eyeR+size*0.02}" cy="${eyeY+size*0.1}" r="${size*0.05}" fill="rgba(255,150,150,0.35)"/>`;
  } else if (accType === 2) { // glasses
    acc = `<circle cx="${eyeL}" cy="${eyeY}" r="${size*0.09}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="${size*0.015}"/><circle cx="${eyeR}" cy="${eyeY}" r="${size*0.09}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="${size*0.015}"/><line x1="${eyeL+size*0.09}" y1="${eyeY}" x2="${eyeR-size*0.09}" y2="${eyeY}" stroke="rgba(255,255,255,0.5)" stroke-width="${size*0.015}"/>`;
  } else if (accType === 3) { // hat
    acc = `<rect x="${size*0.25}" y="${size*0.05}" width="${size*0.5}" height="${size*0.13}" rx="${size*0.03}" fill="rgba(255,255,255,0.25)"/><rect x="${size*0.15}" y="${size*0.15}" width="${size*0.7}" height="${size*0.04}" rx="${size*0.02}" fill="rgba(255,255,255,0.25)"/>`;
  } else if (accType === 4) { // bow
    acc = `<path d="M${size*0.5} ${size*0.12} L${size*0.38} ${size*0.05} L${size*0.5} ${size*0.12} L${size*0.62} ${size*0.05} Z" fill="rgba(255,200,200,0.5)"/><circle cx="${size*0.5}" cy="${size*0.12}" r="${size*0.025}" fill="rgba(255,200,200,0.7)"/>`;
  } else if (accType === 5) { // freckles
    acc = `<circle cx="${eyeL+size*0.02}" cy="${eyeY+size*0.12}" r="${size*0.012}" fill="rgba(255,255,255,0.3)"/><circle cx="${eyeL-size*0.03}" cy="${eyeY+size*0.1}" r="${size*0.012}" fill="rgba(255,255,255,0.3)"/><circle cx="${eyeR-size*0.02}" cy="${eyeY+size*0.12}" r="${size*0.012}" fill="rgba(255,255,255,0.3)"/><circle cx="${eyeR+size*0.03}" cy="${eyeY+size*0.1}" r="${size*0.012}" fill="rgba(255,255,255,0.3)"/>`;
  } else if (accType === 6) { // rosy cheeks + sparkle
    acc = `<circle cx="${eyeL-size*0.04}" cy="${eyeY+size*0.1}" r="${size*0.04}" fill="rgba(255,200,200,0.3)"/><circle cx="${eyeR+size*0.04}" cy="${eyeY+size*0.1}" r="${size*0.04}" fill="rgba(255,200,200,0.3)"/><text x="${size*0.78}" y="${size*0.2}" font-size="${size*0.1}" fill="rgba(255,255,255,0.6)">✦</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${size*0.15}" fill="${bg}"/><circle cx="${size*0.5}" cy="${faceY}" r="${r}" fill="rgba(255,255,255,0.12)"/>${eyes}${mouth}${acc}</svg>`;
}


function generateCuteName(uuid) {
  const h = hashUUID(uuid);
  const adjs = t('cute_adj');
  const anis = t('cute_ani');
  const adj = adjs[h % adjs.length];
  const ani = anis[(h >> 8) % anis.length];
  return currentLang === 'zh' ? (adj + ani) : (adj + ' ' + ani);
}

// Dragging state
let dragPiece = null;
let dragOffsetRow = 0;
let dragOffsetCol = 0;
let dragFromBoard = false; // true when dragging a piece off the board
let dragPointerId = null;  // for pointer capture
let selectedPiece = null;  // tap-to-select mode for mobile
let dragStartX = 0;
let dragStartY = 0;
const TAP_THRESHOLD = 10; // px - distinguish tap from drag

var _hintsThisPuzzle = 0;
var _poolHintTimer = null;

// --- Lazy Timer ---
function ensureTimerRunning() {
  if (timerStarted || gameOver || paused) return;
  timerStarted = true;
  startTime = Date.now();
  timerInterval = setInterval(() => {
    elapsed = elapsedBeforePause + Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('timer').textContent = formatTime(elapsed);
  }, 250);
  document.getElementById('pause-btn').style.display = '';
}

function pauseGame() {
  if (!timerStarted || gameOver || paused) return;
  paused = true;
  clearInterval(timerInterval);
  timerInterval = null;
  elapsedBeforePause = elapsed;
  document.getElementById('pause-overlay').classList.add('show');
  document.getElementById('timer').style.opacity = '0.4';
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  startTime = Date.now();
  timerInterval = setInterval(() => {
    elapsed = elapsedBeforePause + Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('timer').textContent = formatTime(elapsed);
  }, 250);
  document.getElementById('pause-overlay').classList.remove('show');
  document.getElementById('timer').style.opacity = '';
}

function rotateShape(shape) {
  const rows = shape.length, cols = shape[0].length;
  const rotated = [];
  for (let c = 0; c < cols; c++) {
    rotated[c] = [];
    for (let r = rows - 1; r >= 0; r--) {
      rotated[c].push(shape[r][c]);
    }
  }
  return rotated;
}

function initBoard() {
  board = Array.from({ length: 8 }, () => Array(8).fill(null));
}

function canPlace(shape, startR, startC, ignorePieceId) {
  const rows = shape.length, cols = shape[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!shape[r][c]) continue;
      const br = startR + r, bc = startC + c;
      if (br < 0 || br >= 8 || bc < 0 || bc >= 8) return false;
      if (board[br][bc] !== null && board[br][bc] !== ignorePieceId) return false;
    }
  }
  return true;
}

function placePiece(shape, startR, startC, pieceId) {
  const rows = shape.length, cols = shape[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!shape[r][c]) continue;
      board[startR + r][startC + c] = pieceId;
    }
  }
}

function removePiece(pieceId) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === pieceId) board[r][c] = null;
    }
  }
}

function getPieceById(id) {
  return pieces.find(p => p.id === id);
}

function getColorForCell(r, c) {
  const pid = board[r][c];
  if (!pid) return null;
  const p = getPieceById(pid);
  return p ? p.color : null;
}

// Load a puzzle by number (1-based)
async function loadPuzzle(puzzleNumber) {
  const cellIndices = await getPuzzleCells(puzzleNumber);
  // cellIndices: [g1, g2a, g2b, g3a, g3b, g3c]
  const greyCells = {
    grey1: [cellIndices[0]],
    grey2: [cellIndices[1], cellIndices[2]],
    grey3: [cellIndices[3], cellIndices[4], cellIndices[5]],
  };
  currentSolution = null; // solved lazily on hint
  initBoard();
  const greys = pieces.filter(p => p.auto);
  for (const g of greys) {
    const indices = greyCells[g.id];
    if (!indices) continue;
    const cells = indices.map(i => [Math.floor(i / 8), i % 8]);
    const minR = Math.min(...cells.map(c => c[0]));
    const minC = Math.min(...cells.map(c => c[1]));
    const maxR = Math.max(...cells.map(c => c[0]));
    const maxC = Math.max(...cells.map(c => c[1]));
    const rows = maxR - minR + 1, cols = maxC - minC + 1;
    const shape = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (const [r, c] of cells) shape[r - minR][c - minC] = 1;
    g.currentShape = shape;
    g.placed = true;
    g.boardR = minR;
    g.boardC = minC;
    placePiece(shape, minR, minC, g.id);
  }
}

function updateHintBtn() {
  const btn = document.getElementById('hint-btn');
  if (!_feature('hints')) { btn.style.display = 'none'; return; }
  const left = Math.max(0, MAX_HINTS - getHintsUsedToday());
  if (left <= 0) {
    btn.textContent = t('hint') + ' (\uD83D\uDC8E' + HINT_DIAMOND_COST + ')';
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = 'pointer';
  } else {
    btn.textContent = t('hint') + ' (' + left + ')';
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = 'pointer';
  }
}

function showHint() {
  if (!_feature('hints')) return; // no hints when feature disabled
  if (gameOver || hintTimeout) return;
  if (getHintsUsedToday() >= MAX_HINTS) {
    showDiamondPurchase(t('hint_buy_name'), HINT_DIAMOND_COST, () => {
      _grantBonusHint();
      _doShowHint();
    });
    return;
  }
  _doShowHint();
}

function _grantBonusHint() {
  const data = _loadHintData();
  data.used = Math.max(0, (data.used || 0) - 1);
  _saveHintData(data);
  updateHintBtn();
}

function _doShowHint() {
  if (gameOver || hintTimeout || getHintsUsedToday() >= MAX_HINTS) return;
  _hintsThisPuzzle++;
  // Solve lazily on first hint request
  if (!currentSolution) {
    const greyBoard = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const pid = board[r][c];
        if (pid && (pid === 'grey1' || pid === 'grey2' || pid === 'grey3'))
          greyBoard[r][c] = pid;
      }
    currentSolution = solvePuzzle(greyBoard);
  }
  if (!currentSolution) return;

  // Pick one random unplaced non-grey piece
  const unplaced = pieces.filter(p => !p.auto && !p.placed);
  if (unplaced.length === 0) return;
  const hintPiece = unplaced[Math.floor(Math.random() * unplaced.length)];

  // Find that piece's cells in the solution
  const hintCells = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (currentSolution[r][c] === hintPiece.id) hintCells.push([r, c]);

  // Flash those cells on the board as ghost overlays
  const boardEl = document.getElementById('board');
  const overlays = [];
  for (const [r, c] of hintCells) {
    const cell = boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    if (!cell) continue;
    cell.classList.add('hint-flash');
    cell.dataset.hintColor = hintPiece.color;
    overlays.push(cell);
  }

  playSound('hint'); haptic(20);
  useHint();
  updateHintBtn();

  hintTimeout = setTimeout(() => {
    overlays.forEach(cell => {
      cell.classList.remove('hint-flash');
      delete cell.dataset.hintColor;
    });
    hintTimeout = null;
  }, 800);
}

async function loadRandomPuzzle() {
  if (!hasEnoughEnergy()) { showEnergyModal(true); return; }
  const num = getRandomPuzzleNumber();
  currentLevel = null;
  currentPuzzleNumber = num;
  await resetGame(num);
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      const pid = board[r][c];
      if (pid) {
        const color = getColorForCell(r, c);
        cell.classList.add('occupied');
        cell.dataset.color = color;
        cell.dataset.pieceId = pid;
        // Piece outline borders: add border where neighbor is different piece or edge
        if (r === 0 || board[r-1][c] !== pid) cell.classList.add('border-top');
        if (r === 7 || board[r+1][c] !== pid) cell.classList.add('border-bottom');
        if (c === 0 || board[r][c-1] !== pid) cell.classList.add('border-left');
        if (c === 7 || board[r][c+1] !== pid) cell.classList.add('border-right');
        // Allow dragging non-grey pieces off the board
        const piece = getPieceById(pid);
        if (piece && !piece.auto) {
          cell.addEventListener('pointerdown', (e) => startDragFromBoard(e, piece));
        }
      }
      // Tap empty cell to place selected piece
      if (!pid && !gameOver) {
        cell.addEventListener('pointerup', (e) => onBoardCellTap(e, r, c));
      }
      boardEl.appendChild(cell);
    }
  }
  // Show preview for selected piece on board
  if (selectedPiece && !selectedPiece.placed) {
    updateSelectedPreview();
  }
  _updateControlButtons();
  if (typeof _updateKbCursor === 'function') _updateKbCursor();
}

function onBoardCellTap(e, row, col) {
  if (paused) return;
  if (!selectedPiece || selectedPiece.placed || dragPiece) return;
  ensureTimerRunning();
  const shape = selectedPiece.currentShape;
  const rows = shape.length, cols = shape[0].length;
  // Place piece centered on tapped cell
  const startR = Math.max(0, Math.min(row - Math.floor(rows / 2), 8 - rows));
  const startC = Math.max(0, Math.min(col - Math.floor(cols / 2), 8 - cols));
  if (canPlace(shape, startR, startC, null)) {
    placePiece(shape, startR, startC, selectedPiece.id);
    recordMove(selectedPiece.id, shape, startR, startC);
    selectedPiece.placed = true;
    selectedPiece = null;
    document.body.classList.remove('piece-selected');
    piecesPlacedCount++;
    playSound('place'); haptic(15);
    renderBoard(); triggerSnap();
    renderPool();
    maybeShowEncourageToast();
    checkWin();
    onPiecePlaced();
  }
}

function updateSelectedPreview() {
  // No persistent preview for tap mode - user taps to place
}

function _doRotateSelected() {
  if (!selectedPiece || selectedPiece.placed) return;
  selectedPiece.currentShape = rotateShape(selectedPiece.currentShape);
  playSound('rotate'); haptic(8);
  renderPool();
  _updateControlButtons();
}

function _updateControlButtons() {
  var r = document.getElementById('ctrl-rotate');
  var u = document.getElementById('ctrl-undo');
  if (r) r.classList.toggle('is-hidden', !selectedPiece || selectedPiece.placed);
  if (u) u.classList.toggle('is-hidden', _placementOrder.length === 0);
}

function selectPiece(piece) {
  if (selectedPiece === piece) {
    // Already selected — rotate it
    _doRotateSelected();
    return;
  } else {
    selectedPiece = piece;
    playSound('select'); haptic(10);
    tutStep2_Rotate(); // onboarding: show rotation hint on first piece selection in puzzle #2
  }
  document.body.classList.toggle('piece-selected', !!selectedPiece && !selectedPiece.placed);
  renderPool();
}

function getPoolCellSize() {
  // Scale pool cells proportionally when board is larger than mobile default
  var cellSize = getCellSize();
  if (cellSize > 44) { // board cells > 44px means we're beyond mobile (400px / 8 ≈ 44)
    // Width constraint: widest piece is 5 cols, must fit in pool sidebar
    var poolSection = document.getElementById('pool-section');
    var maxW = poolSection ? poolSection.clientWidth : 300;
    var maxByWidth = Math.floor((maxW - 24 - 4) / 5); // 24px padding, 4px gap
    // Height constraint: all pieces should fit without excessive scrolling
    // Use 55% of board cell size as target ratio
    var s = Math.round(cellSize * 0.55);
    return Math.max(22, Math.min(s, maxByWidth));
  }
  return PIECE_CELL_PX;
}

function renderPool() {
  const poolEl = document.getElementById('pool');
  var savedScroll = poolEl.scrollLeft;
  poolEl.innerHTML = '';
  const poolCell = getPoolCellSize();
  // Update CSS custom property for desktop pool override
  document.documentElement.style.setProperty('--pool-cell', poolCell + 'px');
  pieces.filter(p => !p.auto).forEach((p, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'piece-wrapper' + (p.placed ? ' placed' : '') + ' color-' + p.color;

    const el = document.createElement('div');
    el.className = 'piece' + (selectedPiece === p ? ' selected' : '');
    el.dataset.id = p.id;
    el.dataset.index = idx;
    const shape = p.currentShape;
    const rows = shape.length, cols = shape[0].length;
    el.style.gridTemplateColumns = `repeat(${cols}, ${poolCell}px)`;
    el.style.gridTemplateRows = `repeat(${rows}, ${poolCell}px)`;
    el.style.setProperty('--cols', cols);
    el.style.setProperty('--rows', rows);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'piece-cell';
        cell.style.width = poolCell + 'px';
        cell.style.height = poolCell + 'px';
        if (shape[r][c]) {
          cell.dataset.color = p.color;
        } else {
          cell.style.visibility = 'hidden';
        }
        el.appendChild(cell);
      }
    }

    // Tap to select OR drag to place
    if (!p.placed) {
      el.addEventListener('pointerdown', (e) => onPiecePointerDown(e, p));
    }

    wrapper.appendChild(el);
    poolEl.appendChild(wrapper);
  });
  // Update crosshair cursor class
  document.body.classList.toggle('piece-selected', !!selectedPiece && !selectedPiece.placed);
  poolEl.scrollLeft = savedScroll;
  var selEl = poolEl.querySelector('.piece.selected');
  if (selEl) {
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    selEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
  }
  updatePoolScrollHints();
  requestAnimationFrame(updatePoolScrollHints);
  if (_poolHintTimer) clearTimeout(_poolHintTimer);
  _poolHintTimer = setTimeout(updatePoolScrollHints, 100);
  _updateControlButtons();
}

function updatePoolScrollHints() {
  const pool = document.getElementById('pool');
  const wrap = document.getElementById('pool-scroll');
  if (!pool || !wrap) return;
  const atStart = pool.scrollLeft <= 2;
  const atEnd = pool.scrollLeft + pool.clientWidth >= pool.scrollWidth - 2;
  wrap.classList.toggle('at-start', atStart);
  wrap.classList.toggle('at-end', atEnd);
  var leftBtn = document.getElementById('pool-left');
  var rightBtn = document.getElementById('pool-right');
  if (leftBtn) leftBtn.disabled = atStart;
  if (rightBtn) rightBtn.disabled = atEnd;
}

let _poolHintShown = false;
function showPoolScrollHint() {
  if (_poolHintShown) return;
  const pool = document.getElementById('pool');
  const hint = document.getElementById('pool-hint');
  if (!pool || !hint) return;
  const overflows = pool.scrollWidth > pool.clientWidth + 4;
  hint.textContent = overflows ? t('pool_scroll_hint') : t('pool_rotate_hint');
  hint.classList.remove('hidden');
  _poolHintShown = true;
  setTimeout(dismissPoolScrollHint, 8000);
}
function dismissPoolScrollHint() {
  const hint = document.getElementById('pool-hint');
  if (hint) hint.classList.add('hidden');
}

// Listen for pool scroll to update fade hints and dismiss scroll hint
document.getElementById('pool').addEventListener('scroll', () => {
  updatePoolScrollHints();
  dismissPoolScrollHint();
}, { passive: true });

// Pool arrow buttons (mobile)
function scrollPool(dir) {
  var pool = document.getElementById('pool');
  if (!pool) return;
  pool.scrollBy({ left: dir * pool.clientWidth * 0.6, behavior: 'smooth' });
}
document.getElementById('pool-left').addEventListener('click', () => scrollPool(-1));
document.getElementById('pool-right').addEventListener('click', () => scrollPool(1));

function getCellSize() {
  const boardEl = document.getElementById('board');
  const rect = boardEl.getBoundingClientRect();
  // account for padding (3px each side) and gaps (7 gaps * 2px)
  return (rect.width - 6 - 14) / 8;
}

function buildGhost(piece) {
  const shape = piece.currentShape;
  const rows = shape.length, cols = shape[0].length;
  const ghost = document.getElementById('drag-ghost');
  const cellSize = getCellSize();
  ghost.style.setProperty('--cell-size', cellSize + 'px');
  ghost.style.display = 'grid';
  ghost.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
  ghost.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
  ghost.style.gap = '2px';
  ghost.innerHTML = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'piece-cell';
      if (shape[r][c]) {
        cell.dataset.color = piece.color;
      } else {
        cell.style.visibility = 'hidden';
      }
      cell.style.width = cellSize + 'px';
      cell.style.height = cellSize + 'px';
      ghost.appendChild(cell);
    }
  }
}

function capturePointer(e) {
  dragPointerId = e.pointerId;
  // Capture on a persistent element so events survive re-renders
  const boardEl = document.getElementById('board');
  try { boardEl.setPointerCapture(e.pointerId); } catch (err) { console.warn('Pointer capture failed:', err.message); }
  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', onDragEnd);
  document.addEventListener('pointercancel', onDragCancel);
}

function releasePointer() {
  if (dragPointerId !== null) {
    const boardEl = document.getElementById('board');
    try { boardEl.releasePointerCapture(dragPointerId); } catch (err) { console.warn('Pointer release failed:', err.message); }
    dragPointerId = null;
  }
  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', onDragEnd);
  document.removeEventListener('pointercancel', onDragCancel);
}

function onDragCancel(e) {
  if (!dragPiece) return;
  releasePointer();
  const ghost = document.getElementById('drag-ghost');
  ghost.style.display = 'none';
  clearPreview();
  // Return piece to pool if it was dragged from board
  if (dragFromBoard) {
    dragPiece.placed = false;
  }
  renderBoard();
  renderPool();
  dragPiece = null;
  dragFromBoard = false;
}

function startDragFromBoard(e, piece) {
  if (gameOver || paused) return;
  ensureTimerRunning();
  e.preventDefault();
  selectedPiece = null;
  dragPiece = piece;
  dragFromBoard = true;

  // Figure out offset based on which cell of the piece was clicked
  const clickedR = parseInt(e.currentTarget.dataset.row);
  const clickedC = parseInt(e.currentTarget.dataset.col);
  // Find top-left of this piece on the board
  let minR = 8, minC = 8;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === piece.id) {
        if (r < minR) minR = r;
        if (c < minC) minC = c;
      }
    }
  }
  dragOffsetRow = clickedR - minR;
  dragOffsetCol = clickedC - minC;

  // Capture pointer BEFORE re-rendering destroys the target element
  capturePointer(e);

  // Remove piece from board
  removePiece(piece.id);
  var oi = _placementOrder.lastIndexOf(piece.id);
  if (oi !== -1) { _placementOrder.splice(oi, 1); _moveLog.splice(oi, 1); }
  playSound('remove'); haptic(10);
  renderBoard();

  buildGhost(piece);
  moveGhost(e.clientX, e.clientY);
}

function onPiecePointerDown(e, piece) {
  if (gameOver || paused) return;
  ensureTimerRunning();
  dismissPoolScrollHint();
  e.preventDefault();
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  // Store piece and offset info for potential drag
  const shape = piece.currentShape;
  const cols = shape[0].length;
  const pieceEl = e.currentTarget;
  const rect = pieceEl.getBoundingClientRect();
  const cellW = getPoolCellSize() + 1;
  const relX = e.clientX - rect.left;
  const relY = e.clientY - rect.top;
  const offC = Math.min(Math.floor(relX / cellW), cols - 1);
  const offR = Math.min(Math.floor(relY / cellW), shape.length - 1);

  // Use a pending state: start actual drag only after movement threshold
  let started = false;
  const onMove = (me) => {
    const dx = me.clientX - dragStartX;
    const dy = me.clientY - dragStartY;
    if (!started && Math.sqrt(dx*dx + dy*dy) > TAP_THRESHOLD) {
      started = true;
      // Begin real drag
      dragPiece = piece;
      dragFromBoard = false;
      dragOffsetCol = offC;
      dragOffsetRow = offR;
      selectedPiece = null;
      buildGhost(piece);
      moveGhost(me.clientX, me.clientY);
      renderPool();
    }
    if (started) {
      me.preventDefault();
      moveGhost(me.clientX, me.clientY);
      const { row, col } = getBoardPosForGhost(me.clientX, me.clientY);
      if (row >= 0 && row < 8 && col >= 0 && col < 8) {
        showPreview(dragPiece, row, col);
      } else {
        clearPreview();
      }
    }
  };
  const onUp = (ue) => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    if (!started) {
      // It was a tap — select/deselect piece
      selectPiece(piece);
    } else {
      // End drag
      const ghost = document.getElementById('drag-ghost');
      ghost.style.display = 'none';
      clearPreview();
      if (!dragPiece) return;
      const { row, col } = getBoardPosForGhost(ue.clientX, ue.clientY);
      const sh = dragPiece.currentShape;
      const startR = row - dragOffsetRow;
      const startC = col - dragOffsetCol;
      if (canPlace(sh, startR, startC, null)) {
        placePiece(sh, startR, startC, dragPiece.id);
        recordMove(dragPiece.id, sh, startR, startC);
        dragPiece.placed = true;
        piecesPlacedCount++;
        playSound('place'); haptic(15);
        renderBoard();
        renderPool();
        maybeShowEncourageToast();
        checkWin();
        onPiecePlaced();
      }
      dragPiece = null;
    }
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}

function moveGhost(x, y) {
  const ghost = document.getElementById('drag-ghost');
  const cellSize = getCellSize();
  const gapSize = 2;
  const offsetX = dragOffsetCol * (cellSize + gapSize) + cellSize / 2;
  const offsetY = dragOffsetRow * (cellSize + gapSize) + cellSize / 2;
  // On touch devices, lift ghost above finger so it's visible
  const touchLift = ('ontouchstart' in window) ? 60 : 0;
  ghost.style.left = (x - offsetX) + 'px';
  ghost.style.top = (y - offsetY - touchLift) + 'px';
}

function getBoardPosForGhost(x, y) {
  // Account for touch lift when calculating board position
  const touchLift = ('ontouchstart' in window) ? 60 : 0;
  return getBoardPos(x, y - touchLift);
}

function getBoardPos(x, y) {
  const boardEl = document.getElementById('board');
  const rect = boardEl.getBoundingClientRect();
  const cellSize = getCellSize();
  const padGap = 3; // padding
  const gap = 2;
  const relX = x - rect.left - padGap;
  const relY = y - rect.top - padGap;
  const col = Math.floor(relX / (cellSize + gap));
  const row = Math.floor(relY / (cellSize + gap));
  return { row, col };
}

function clearPreview() {
  document.querySelectorAll('.cell.preview-valid, .cell.preview-invalid').forEach(c => {
    c.classList.remove('preview-valid', 'preview-invalid');
  });
}

function showPreview(piece, boardRow, boardCol) {
  clearPreview();
  const shape = piece.currentShape;
  const startR = boardRow - dragOffsetRow;
  const startC = boardCol - dragOffsetCol;
  const valid = canPlace(shape, startR, startC, null);
  const rows = shape.length, cols = shape[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!shape[r][c]) continue;
      const br = startR + r, bc = startC + c;
      if (br < 0 || br >= 8 || bc < 0 || bc >= 8) continue;
      const cell = document.querySelector(`.cell[data-row="${br}"][data-col="${bc}"]`);
      if (cell) cell.classList.add(valid ? 'preview-valid' : 'preview-invalid');
    }
  }
}

function onDragMove(e) {
  if (!dragPiece) return;
  e.preventDefault();
  moveGhost(e.clientX, e.clientY);

  const { row, col } = getBoardPosForGhost(e.clientX, e.clientY);
  if (row >= 0 && row < 8 && col >= 0 && col < 8) {
    showPreview(dragPiece, row, col);
  } else {
    clearPreview();
  }
}

function onDragEnd(e) {
  if (!dragPiece) return;
  e.preventDefault();
  releasePointer();

  const ghost = document.getElementById('drag-ghost');
  ghost.style.display = 'none';
  clearPreview();

  const { row, col } = getBoardPosForGhost(e.clientX, e.clientY);
  const shape = dragPiece.currentShape;
  const startR = row - dragOffsetRow;
  const startC = col - dragOffsetCol;

  if (canPlace(shape, startR, startC, null)) {
    placePiece(shape, startR, startC, dragPiece.id);
    recordMove(dragPiece.id, shape, startR, startC);
    dragPiece.placed = true;
    piecesPlacedCount++;
    playSound('place'); haptic(15);
    renderBoard(); triggerSnap();
    renderPool();
    maybeShowEncourageToast();
    checkWin();
    onPiecePlaced();
  } else if (dragFromBoard) {
    // Dropped outside or invalid spot — return to pool
    dragPiece.placed = false;
    renderBoard();
    renderPool();
  }

  dragPiece = null;
  dragFromBoard = false;
}

function getSolvedSet() {
  try { return new Set(JSON.parse(localStorage.getItem('octile_solved') || '[]')); }
  catch { return new Set(); }
}

function saveSolvedSet(s) {
  localStorage.setItem('octile_solved', JSON.stringify([...s]));
}

function getWinMotivation(totalUnique, isFirstClear, isNewBest, prevBest, elapsed, improvement) {
  const msgs = [];
  // First time solving this puzzle
  if (isFirstClear) {
    msgs.push(...t('motiv_first_clear'));
  }
  // New personal best (on re-solve)
  if (!isFirstClear && isNewBest) {
    const saved = improvement;
    if (saved >= 60) {
      msgs.push(...t('motiv_big_improve').map(s => s.replace('{saved}', formatTime(saved))));
    } else if (saved > 0) {
      msgs.push(...t('motiv_improve').map(s => s.replace('{saved}', saved + 's')));
    }
  }
  // Speed achievements
  if (elapsed <= 30) msgs.push(...t('motiv_speed_30'));
  else if (elapsed <= 60) msgs.push(...t('motiv_speed_60'));
  // Milestone achievements
  if (totalUnique === 1) msgs.push(...t('motiv_first').map(s => s.replace('{remain}', (getEffectivePuzzleCount() - 1).toLocaleString())));
  else if (totalUnique === 10) msgs.push(...t('motiv_10'));
  else if (totalUnique === 50) msgs.push(...t('motiv_50'));
  else if (totalUnique === 100) msgs.push(...t('motiv_100'));
  else if (totalUnique === 500) msgs.push(...t('motiv_500'));
  else if (totalUnique === 1000) msgs.push(...t('motiv_1000'));
  else if (totalUnique % 100 === 0) msgs.push(...t('motiv_hundred').map(s => s.replace('{n}', totalUnique)));
  // Progress
  const pct = (totalUnique / getEffectivePuzzleCount() * 100).toFixed(1);
  if (totalUnique > 1 && !msgs.length) {
    msgs.push(...t('motiv_progress').map(s => s.replace('{n}', totalUnique).replace('{total}', getEffectivePuzzleCount().toLocaleString()).replace('{pct}', pct)));
  }
  return msgs.length ? msgs[Math.floor(Math.random() * msgs.length)] : '';
}

// =============================================================================
// 05a-gamepad.js — Gamepad/controller support (Steam/Electron only)
// =============================================================================

var GP_A = 0, GP_B = 1, GP_X = 2, GP_Y = 3, GP_LB = 4, GP_RB = 5;
var GP_START = 9, GP_DU = 12, GP_DD = 13, GP_DL = 14, GP_DR = 15;
var GP_DEADZONE = 0.3;
var GP_REPEAT_DELAY = 300;
var GP_REPEAT_RATE = 100;

var _gpConnected = false;
var _gpPrevButtons = [];
var _gpRafId = null;
var _gpRepeatState = {}; // { direction: { active, firstFire, lastFire } }

function _gpInit() {
  if (!navigator.getGamepads) return;
  window.addEventListener('gamepadconnected', function(e) {
    _gpConnected = true;
    console.log('Gamepad connected: ' + e.gamepad.id);
    if (!_gpRafId) _gpRafId = requestAnimationFrame(_gpPoll);
  });
  window.addEventListener('gamepaddisconnected', function() {
    _gpConnected = false;
    console.log('Gamepad disconnected');
    if (_gpRafId) { cancelAnimationFrame(_gpRafId); _gpRafId = null; }
    _gpPrevButtons = [];
    _gpRepeatState = {};
  });
}

// --- Polling loop ---
function _gpPoll() {
  _gpRafId = requestAnimationFrame(_gpPoll);
  if (!_gpConnected) return;
  var gamepads = navigator.getGamepads();
  var gp = null;
  for (var i = 0; i < gamepads.length; i++) {
    if (gamepads[i] && gamepads[i].connected) { gp = gamepads[i]; break; }
  }
  if (!gp) return;

  // Detect any input to activate keyboard/cursor mode
  var hasInput = false;
  for (var b = 0; b < gp.buttons.length; b++) {
    if (gp.buttons[b].pressed) { hasInput = true; break; }
  }
  if (!hasInput && gp.axes) {
    for (var a = 0; a < gp.axes.length; a++) {
      if (Math.abs(gp.axes[a]) > GP_DEADZONE) { hasInput = true; break; }
    }
  }
  if (hasInput) _gpActivateInputMode();

  // Context dispatch
  if (_isModalOpen()) _gpHandleModal(gp);
  else if (_winStep > 0) _gpHandleWin(gp);
  else if (paused) _gpHandlePaused(gp);
  else if (_isInGame()) _gpHandleInGame(gp);
  else _gpHandleWelcome(gp);

  // Save button state for edge detection
  _gpPrevButtons = [];
  for (var j = 0; j < gp.buttons.length; j++) {
    _gpPrevButtons[j] = gp.buttons[j].pressed;
  }
}

// --- Input helpers ---
function _gpActivateInputMode() {
  if (_inputMode !== 'keyboard') {
    _inputMode = 'keyboard';
    if (_kbCursorR < 0) { _kbCursorR = 3; _kbCursorC = 3; }
    _updateKbCursor();
  }
}

function _gpPressed(gp, idx) {
  return gp.buttons[idx] && gp.buttons[idx].pressed && !_gpPrevButtons[idx];
}

function _gpDigitizeStick(axisX, axisY) {
  return {
    left: axisX < -GP_DEADZONE,
    right: axisX > GP_DEADZONE,
    up: axisY < -GP_DEADZONE,
    down: axisY > GP_DEADZONE
  };
}

function _gpDirectionUpdate(dir, pressed) {
  if (!_gpRepeatState[dir]) _gpRepeatState[dir] = { active: false, firstFire: 0, lastFire: 0 };
  var s = _gpRepeatState[dir];
  var now = performance.now();
  if (!pressed) {
    s.active = false;
    return false;
  }
  if (!s.active) {
    s.active = true;
    s.firstFire = now;
    s.lastFire = now;
    return true; // fire immediately
  }
  // Repeat logic
  var elapsed = now - s.firstFire;
  if (elapsed >= GP_REPEAT_DELAY && now - s.lastFire >= GP_REPEAT_RATE) {
    s.lastFire = now;
    return true;
  }
  return false;
}

function _gpMoveCursor(gp) {
  var dpad = {
    up: gp.buttons[GP_DU] && gp.buttons[GP_DU].pressed,
    down: gp.buttons[GP_DD] && gp.buttons[GP_DD].pressed,
    left: gp.buttons[GP_DL] && gp.buttons[GP_DL].pressed,
    right: gp.buttons[GP_DR] && gp.buttons[GP_DR].pressed
  };
  var stick = _gpDigitizeStick(gp.axes[0] || 0, gp.axes[1] || 0);
  var up = dpad.up || stick.up;
  var down = dpad.down || stick.down;
  var left = dpad.left || stick.left;
  var right = dpad.right || stick.right;

  if (_kbCursorR < 0) { _kbCursorR = 3; _kbCursorC = 3; }
  var moved = false;
  if (_gpDirectionUpdate('up', up)) { _kbCursorR = Math.max(0, _kbCursorR - 1); moved = true; }
  if (_gpDirectionUpdate('down', down)) { _kbCursorR = Math.min(7, _kbCursorR + 1); moved = true; }
  if (_gpDirectionUpdate('left', left)) { _kbCursorC = Math.max(0, _kbCursorC - 1); moved = true; }
  if (_gpDirectionUpdate('right', right)) { _kbCursorC = Math.min(7, _kbCursorC + 1); moved = true; }
  if (moved) _updateKbCursor();
}

function _gpCyclePiece(dir) {
  var playable = pieces.filter(function(p) { return !p.auto && !p.placed; });
  if (playable.length === 0) return;
  var curIdx = selectedPiece ? playable.indexOf(selectedPiece) : -1;
  var nextIdx = curIdx < 0 ? 0 : (curIdx + dir + playable.length) % playable.length;
  selectPiece(playable[nextIdx]);
}

// --- Context handlers ---
function _gpHandleInGame(gp) {
  _gpMoveCursor(gp);
  if (_gpPressed(gp, GP_A)) {
    if (_kbCursorR < 0) { _kbCursorR = 3; _kbCursorC = 3; _updateKbCursor(); }
    _kbPlaceAtCursor();
  }
  if (_gpPressed(gp, GP_B)) _kbUndoLastPlacement();
  if (_gpPressed(gp, GP_X)) _doRotateSelected();
  if (_gpPressed(gp, GP_Y)) showHint();
  if (_gpPressed(gp, GP_LB)) _gpCyclePiece(-1);
  if (_gpPressed(gp, GP_RB)) _gpCyclePiece(1);
  if (_gpPressed(gp, GP_START)) pauseGame();
}

function _gpHandleModal(gp) {
  if (_gpPressed(gp, GP_A)) {
    // Click primary button in reward modal, or first visible button in topmost modal
    var rewardBtn = document.getElementById('reward-primary');
    if (rewardBtn && rewardBtn.offsetParent !== null) { rewardBtn.click(); return; }
    for (var i = 0; i < _modalIds.length; i++) {
      var modal = document.getElementById(_modalIds[i]);
      if (modal && modal.classList.contains('show')) {
        var btn = modal.querySelector('button:not([style*="display: none"]):not([style*="display:none"])');
        if (btn) btn.click();
        return;
      }
    }
  }
  if (_gpPressed(gp, GP_B)) handleAndroidBack();
}

function _gpHandleWin(gp) {
  if (_gpPressed(gp, GP_A)) {
    // Advance through win steps
    for (var step = 1; step <= 3; step++) {
      var el = document.getElementById('win-step' + step);
      if (el && el.style.display !== 'none' && el.offsetParent !== null) { el.click(); return; }
    }
    var nextBtn = document.getElementById('win-next-btn');
    if (nextBtn && nextBtn.offsetParent !== null) nextBtn.click();
  }
}

function _gpHandlePaused(gp) {
  if (_gpPressed(gp, GP_A) || _gpPressed(gp, GP_START)) resumeGame();
  if (_gpPressed(gp, GP_B)) returnToWelcome();
}

function _gpHandleWelcome(gp) {
  if (_gpPressed(gp, GP_A)) {
    var resumeBtn = document.getElementById('wp-resume');
    if (resumeBtn && resumeBtn.style.display !== 'none') { resumeBtn.click(); return; }
    // Fallback: click the daily challenge card if visible
    var dcCard = document.getElementById('wp-daily-challenge');
    if (dcCard && dcCard.style.display !== 'none') dcCard.click();
  }
}
// --- Energy System ---
var ENERGY_MAX = 5;
var ENERGY_RESTORE_COST = 50;
var ENERGY_RECOVERY_PERIOD = 10 * 60 * 60; // 10 hours full refill (1 per 2h)
var ENERGY_PER_SECOND = ENERGY_MAX / ENERGY_RECOVERY_PERIOD;

function getEnergyState() {
  try {
    const raw = localStorage.getItem('octile_energy');
    if (raw) {
      const state = JSON.parse(raw);
      const now = Date.now();
      const elapsedSec = Math.max(0, (now - state.ts) / 1000);
      const recovered = elapsedSec * ENERGY_PER_SECOND;
      const points = Math.min(ENERGY_MAX, state.points + recovered);
      return { points, ts: now };
    }
  } catch (e) {}
  return { points: ENERGY_MAX, ts: Date.now() };
}

function saveEnergyState(points) {
  localStorage.setItem('octile_energy', JSON.stringify({ points, ts: Date.now() }));
}

function deductEnergy(cost) {
  if (!_feature('energy')) return;
  if (_debugUnlimitedEnergy) return;
  const state = getEnergyState();
  const newPoints = Math.max(0, state.points - cost);
  saveEnergyState(newPoints);
  updateEnergyDisplay();
}

function hasEnoughEnergy() {
  if (!_feature('energy')) return true;
  if (_debugUnlimitedEnergy) return true;
  // First puzzle of the day is always free
  const stats = getDailyStats();
  if (stats.puzzles === 0) return true;
  return getEnergyState().points >= 1;
}

function energyCost(_elapsedSec) {
  // First puzzle of the day is free
  const stats = getDailyStats();
  if (stats.puzzles === 0) return 0;
  return 1; // flat cost
}

var _lastEnergyValue = -1;
function updateEnergyDisplay() {
  const display = document.getElementById('energy-display');
  if (!_feature('energy')) { display.style.display = 'none'; return; }
  display.style.display = '';
  const state = getEnergyState();
  const pts = state.points;
  const plays = Math.floor(pts);
  const valueEl = document.getElementById('energy-value');
  // Show as plays remaining; add +1 visual if first daily puzzle is free
  const stats = getDailyStats();
  const freePlay = stats.puzzles === 0 ? 1 : 0;
  var newVal = plays + freePlay;
  valueEl.textContent = newVal;
  display.classList.remove('low', 'empty');
  if (newVal <= 0) display.classList.add('empty');
  else if (newVal <= 2) display.classList.add('low');
  if (_lastEnergyValue >= 0 && newVal !== _lastEnergyValue && display.animate) {
    display.animate([
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1.4)', offset: 0.25 },
      { transform: 'scale(0.85)', offset: 0.55 },
      { transform: 'scale(1.1)', offset: 0.8 },
      { transform: 'scale(1)', offset: 1 }
    ], { duration: 600, easing: 'ease-out' });
  }
  _lastEnergyValue = newVal;
}

function getDailyStats() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem('octile_energy_day');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.date === today) return data;
    }
  } catch (e) {}
  return { date: today, puzzles: 0, spent: 0 };
}

function updateDailyStats(cost) {
  const stats = getDailyStats();
  stats.puzzles += 1;
  stats.spent += cost;
  localStorage.setItem('octile_energy_day', JSON.stringify(stats));
}

function formatTimeHMS(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function showEnergyModal(isOutOfEnergy) {
  const state = getEnergyState();
  const pts = state.points;
  const plays = Math.floor(pts);
  const stats = getDailyStats();
  const freePlay = stats.puzzles === 0 ? 1 : 0;
  const totalPlays = plays + freePlay;

  const titleEl = document.getElementById('energy-modal-title');
  titleEl.textContent = isOutOfEnergy ? t('energy_break_title') : t('energy_title');

  const bar = document.getElementById('energy-bar');
  const pct = (pts / ENERGY_MAX) * 100;
  bar.style.width = pct + '%';
  bar.classList.remove('low', 'empty');
  if (totalPlays <= 0) bar.classList.add('empty');
  else if (totalPlays <= 2) bar.classList.add('low');

  // Plays remaining
  document.getElementById('energy-points-display').textContent = t('energy_plays').replace('{n}', totalPlays);

  // Recovery info
  const recoveryEl = document.getElementById('energy-recovery-info');
  if (pts >= ENERGY_MAX) {
    recoveryEl.style.display = 'none';
  } else {
    const secsToNext = Math.ceil((Math.ceil(pts) + 1 - pts) / ENERGY_PER_SECOND);
    const secsToFull = Math.ceil((ENERGY_MAX - pts) / ENERGY_PER_SECOND);
    recoveryEl.style.display = '';
    recoveryEl.innerHTML = t('energy_next_play').replace('{time}', formatTimeHMS(secsToNext)) +
      '<br>' + t('energy_full_in').replace('{time}', formatTimeHMS(secsToFull));
  }

  // Daily stats
  document.getElementById('energy-daily-stats').textContent = t('energy_today').replace('{n}', stats.puzzles).replace('{cost}', stats.spent);

  // Tip area — context-sensitive messaging
  const tipEl = document.getElementById('energy-tip');
  tipEl.style.display = '';
  if (isOutOfEnergy) {
    // "Take a break" — caring, with time info
    const secsToNext = Math.ceil((1 - (pts % 1 || 0)) / ENERGY_PER_SECOND);
    tipEl.innerHTML = t('energy_break_msg').replace('{time}', formatTimeHMS(secsToNext)).replace(/\n/g, '<br>')
      + '<br><br><em>' + t('energy_break_quote') + '</em>';
  } else if (totalPlays === 1) {
    // Soft warning — "1 puzzle left, break might be nice"
    tipEl.innerHTML = t('energy_last_one');
  } else if (freePlay) {
    tipEl.innerHTML = t('energy_free_hint').replace(/\n/g, '<br>');
  } else {
    tipEl.textContent = t('energy_tip');
    tipEl.style.display = totalPlays <= 3 ? '' : 'none';
  }

  // Energy restore button
  var restoreBtn = document.getElementById('energy-restore-btn');
  if (totalPlays < ENERGY_MAX) {
    restoreBtn.textContent = t('energy_restore').replace('{cost}', ENERGY_RESTORE_COST);
    restoreBtn.classList.add('show');
    restoreBtn.onclick = () => {
      document.getElementById('energy-modal').classList.remove('show');
      showDiamondPurchase(t('energy_restore_item'), ENERGY_RESTORE_COST, () => {
        // Add 1 energy point
        var st = getEnergyState();
        var newPts = Math.min(ENERGY_MAX, st.points + 1);
        localStorage.setItem('octile_energy', JSON.stringify({ points: newPts, ts: Date.now() }));
        updateEnergyDisplay();
        showEnergyModal(false);
      });
    };
  } else {
    restoreBtn.classList.remove('show');
  }

  document.getElementById('energy-modal').classList.add('show');
}

// --- Achievement System ---
// --- EXP + Diamond System ---
var EXP_BASE = { easy: 100, medium: 250, hard: 750, hell: 2000 };
var PAR_TIMES = { easy: 60, medium: 90, hard: 120, hell: 180 };

// Migrate old coins to EXP on first load
(function _migrateCoinsToExp() {
  if (localStorage.getItem('octile_exp') === null && localStorage.getItem('octile_coins') !== null) {
    localStorage.setItem('octile_exp', localStorage.getItem('octile_coins'));
  }
})();

function getExp() {
  return parseInt(localStorage.getItem('octile_exp') || '0');
}

function addExp(amount) {
  const total = getExp() + amount;
  localStorage.setItem('octile_exp', total);
  updateExpDisplay();
  return total;
}

var _lastExpValue = 0;
function updateExpDisplay() {
  const el = document.getElementById('exp-value');
  if (!el) return;
  var newVal = getExp();
  el.textContent = newVal.toLocaleString();
  if (newVal > _lastExpValue && _lastExpValue > 0 && el.animate) {
    el.animate([
      { transform: 'scale(1)', color: '#f1c40f' },
      { transform: 'scale(2)', color: '#fff', offset: 0.25 },
      { transform: 'scale(0.85)', color: '#ffe066', offset: 0.6 },
      { transform: 'scale(1.1)', color: '#f1c40f', offset: 0.8 },
      { transform: 'scale(1)', color: '#f1c40f' }
    ], { duration: 800, easing: 'ease-out' });
  }
  _lastExpValue = newVal;
}

function getDiamonds() {
  return parseInt(localStorage.getItem('octile_diamonds') || '0');
}

function addDiamonds(amount) {
  const total = Math.max(0, getDiamonds() + amount);
  localStorage.setItem('octile_diamonds', total);
  updateDiamondDisplay();
  if (amount > 0) fxDiamondSparkle(document.getElementById('diamond-display'));
  return total;
}

var _diamondAnimFrame = 0;
function updateDiamondDisplay() {
  const el = document.getElementById('diamond-value');
  if (!el) return;
  var target = getDiamonds();
  var current = parseInt(el.textContent.replace(/,/g, '')) || 0;
  if (current === target || !el.animate) { el.textContent = target.toLocaleString(); return; }
  if (_diamondAnimFrame) cancelAnimationFrame(_diamondAnimFrame);
  var start = performance.now(), dur = 800;
  var from = current, diff = target - from;
  function tick(now) {
    var t = Math.min((now - start) / dur, 1);
    t = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = Math.round(from + diff * t).toLocaleString();
    if (t < 1) _diamondAnimFrame = requestAnimationFrame(tick);
    else _diamondAnimFrame = 0;
  }
  _diamondAnimFrame = requestAnimationFrame(tick);
}

// --- Diamond Purchase Confirmation Dialog ---
let _dpOnConfirm = null;
function showDiamondPurchase(itemName, cost, onConfirm) {
  _dpOnConfirm = onConfirm;
  const balance = getDiamonds();
  document.getElementById('dp-title').textContent = t('dp_title');
  document.getElementById('dp-item-name').textContent = itemName;
  document.getElementById('dp-cost-label').textContent = t('dp_cost_label');
  document.getElementById('dp-cost-value').textContent = cost.toLocaleString() + ' \uD83D\uDC8E';
  document.getElementById('dp-balance-label').textContent = t('dp_balance_label');
  document.getElementById('dp-balance-value').textContent = balance.toLocaleString() + ' \uD83D\uDC8E';
  const insuffEl = document.getElementById('dp-insufficient');
  const confirmBtn = document.getElementById('dp-confirm');
  if (balance < cost) {
    insuffEl.textContent = t('dp_insufficient');
    confirmBtn.disabled = true;
  } else {
    insuffEl.textContent = '';
    confirmBtn.disabled = false;
  }
  document.getElementById('dp-cancel').textContent = t('dp_cancel');
  confirmBtn.textContent = t('dp_confirm');
  confirmBtn.onclick = () => {
    addDiamonds(-cost);
    document.getElementById('diamond-purchase-modal').classList.remove('show');
    if (_dpOnConfirm) _dpOnConfirm();
    _dpOnConfirm = null;
  };
  document.getElementById('diamond-purchase-modal').classList.add('show');
}
document.getElementById('dp-cancel').addEventListener('click', () => {
  document.getElementById('diamond-purchase-modal').classList.remove('show');
  _dpOnConfirm = null;
});
document.getElementById('diamond-purchase-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove('show');
    _dpOnConfirm = null;
  }
});

// Skill grade: S/A/B based on par time and hints used this puzzle
function calcSkillGrade(level, elapsed) {
  const par = PAR_TIMES[level] || 90;
  const noHint = _hintsThisPuzzle === 0;
  if (elapsed <= par && noHint) return 'S';
  if (elapsed <= par * 2 || noHint) return 'A';
  return 'B';
}

function gradeMultiplier(grade) {
  if (grade === 'S') return 2.0;
  if (grade === 'A') return 1.5;
  return 1.0;
}

function calcPuzzleExp(level, elapsed) {
  const base = EXP_BASE[level] || 100;
  const grade = calcSkillGrade(level, elapsed);
  return Math.round(base * gradeMultiplier(grade));
}

function getChaptersCompleted() {
  return parseInt(localStorage.getItem('octile_chapters_completed') || '0');
}

function incrementChaptersCompleted() {
  const n = getChaptersCompleted() + 1;
  localStorage.setItem('octile_chapters_completed', n);
  return n;
}

// Daily check-in with streak combo
function getDailyCheckin() {
  try { return JSON.parse(localStorage.getItem('octile_daily_checkin') || '{}'); }
  catch { return {}; }
}

function doDailyCheckin() {
  const today = new Date().toISOString().slice(0, 10);
  const data = getDailyCheckin();
  if (data.lastDate === today) return null; // already checked in today
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let combo = 1;
  if (data.lastDate === yesterday) {
    combo = (data.combo || 0) + 1;
  }
  const baseDiamonds = _cfg('checkin.baseDiamonds', 5);
  // Combo bonus: day1=5, day2=10, day3=15... capped at day7=35, then repeats
  const comboDay = Math.min(combo, _cfg('checkin.comboCap', 7));
  const reward = baseDiamonds * comboDay;
  const newData = { lastDate: today, combo: combo };
  localStorage.setItem('octile_daily_checkin', JSON.stringify(newData));
  addDiamonds(reward);
  return { reward, combo };
}

function showDailyCheckinToast(reward, combo) {
  // disable all toast
  return;
  const toast = document.getElementById('achieve-toast');
  toast.querySelector('.toast-icon').textContent = '\uD83D\uDC8E';
  toast.querySelector('.toast-label').textContent = t('daily_checkin');
  toast.querySelector('.toast-name').textContent = t('daily_checkin_reward').replace('{diamonds}', reward).replace('{combo}', combo);
  toast.classList.add('show');
  toast.style.cursor = 'pointer';
  toast.onclick = function() {
    toast.classList.remove('show');
    if (achieveToastTimer) { clearTimeout(achieveToastTimer); achieveToastTimer = null; }
    showGoalsModal('tasks');
  };
  if (achieveToastTimer) clearTimeout(achieveToastTimer);
  achieveToastTimer = setTimeout(() => { toast.classList.remove('show'); achieveToastTimer = null; }, 3500);
}

function getClaimedAchievements() {
  try { return JSON.parse(localStorage.getItem('octile_ach_claimed') || '{}'); }
  catch { return {}; }
}

function claimAchievementDiamonds(achId) {
  const claimed = getClaimedAchievements();
  if (claimed[achId]) return 0;
  const ach = ACHIEVEMENTS.find(a => a.id === achId);
  if (!ach) return 0;
  claimed[achId] = Date.now();
  localStorage.setItem('octile_ach_claimed', JSON.stringify(claimed));
  addDiamonds(ach.diamonds);
  return ach.diamonds;
}

const ACHIEVEMENTS = [
  // Milestone: unique puzzles solved
  { id: 'first_solve',   icon: '\uD83C\uDFAF', cat: 'milestone', diamonds: 50,   check: s => s.unique >= 1 },
  { id: 'solve_10',      icon: '\u2B50',         cat: 'milestone', diamonds: 100,  check: s => s.unique >= 10 },
  { id: 'solve_50',      icon: '\uD83C\uDF1F',   cat: 'milestone', diamonds: 200,  check: s => s.unique >= 50 },
  { id: 'solve_100',     icon: '\uD83D\uDD25',   cat: 'milestone', diamonds: 500,  check: s => s.unique >= 100 },
  { id: 'solve_500',     icon: '\uD83D\uDC8E',   cat: 'milestone', diamonds: 1000, check: s => s.unique >= 500 },
  { id: 'solve_1000',    icon: '\uD83D\uDC51',   cat: 'milestone', diamonds: 2000, check: s => s.unique >= 1000 },
  { id: 'solve_5000',    icon: '\uD83C\uDFC6',   cat: 'milestone', diamonds: 5000, check: s => s.unique >= 5000 },
  { id: 'solve_all',     icon: '\uD83C\uDF0C',   cat: 'milestone', diamonds: 50000,check: s => s.unique >= getEffectivePuzzleCount() },
  // Speed
  { id: 'speed_60',      icon: '\u23F1\uFE0F',   cat: 'speed', diamonds: 100,  check: s => s.elapsed <= 60 },
  { id: 'speed_45',      icon: '\u23F3',          cat: 'speed', diamonds: 200,  check: s => s.elapsed <= 45 },
  { id: 'speed_30',      icon: '\u26A1',          cat: 'speed', diamonds: 300,  check: s => s.elapsed <= 30 },
  { id: 'speed_15',      icon: '\uD83D\uDE80',   cat: 'speed', diamonds: 500,  check: s => s.elapsed <= 15 },
  // Dedication
  { id: 'total_20',      icon: '\uD83D\uDD01',   cat: 'dedication', diamonds: 100,  check: s => s.total >= 20 },
  { id: 'total_100',     icon: '\uD83D\uDCAA',   cat: 'dedication', diamonds: 300,  check: s => s.total >= 100 },
  { id: 'total_500',     icon: '\uD83C\uDFCB\uFE0F', cat: 'dedication', diamonds: 500,  check: s => s.total >= 500 },
  { id: 'total_1000',    icon: '\uD83C\uDF96\uFE0F', cat: 'dedication', diamonds: 1000, check: s => s.total >= 1000 },
  // Streak (consecutive days)
  { id: 'streak_3',      icon: '\uD83D\uDD25',   cat: 'streak', diamonds: 50,   check: s => s.streak >= 3 },
  { id: 'streak_7',      icon: '\uD83C\uDF08',   cat: 'streak', diamonds: 100,  check: s => s.streak >= 7 },
  { id: 'streak_30',     icon: '\u2604\uFE0F',   cat: 'streak', diamonds: 300,  check: s => s.streak >= 30 },
  { id: 'streak_100',    icon: '\uD83C\uDF0B',   cat: 'streak', diamonds: 500,  check: s => s.streak >= 100 },
  { id: 'streak_200',    icon: '\uD83C\uDF0A',   cat: 'streak', diamonds: 1000, check: s => s.streak >= 200 },
  { id: 'streak_300',    icon: '\uD83C\uDF0D',   cat: 'streak', diamonds: 1500, check: s => s.streak >= 300 },
  { id: 'streak_365',    icon: '\uD83C\uDF89',   cat: 'streak', diamonds: 2000, check: s => s.streak >= 365 },
  // Special
  { id: 'no_hint',       icon: '\uD83E\uDDD0',   cat: 'special', diamonds: 100,  check: s => s.noHint },
  { id: 'five_in_day',   icon: '\uD83C\uDF86',   cat: 'special', diamonds: 150,  check: s => s.dailyCount >= 5 },
  { id: 'ten_in_day',    icon: '\uD83D\uDCAF',   cat: 'special', diamonds: 300,  check: s => s.dailyCount >= 10 },
  { id: 'night_owl',     icon: '\uD83E\uDD89',   cat: 'special', diamonds: 100,  check: s => { const h = new Date().getHours(); return h >= 0 && h < 5 && s.justSolved; } },
  { id: 'night_100',     icon: '\uD83C\uDF19',   cat: 'special', diamonds: 500,  check: s => s.nightSolves >= 100 },
  { id: 'morning_100',   icon: '\uD83C\uDF05',   cat: 'special', diamonds: 500,  check: s => s.morningSolves >= 100 },
  { id: 'rank_1',        icon: '\uD83E\uDD47',   cat: 'special', diamonds: 1000, check: s => s.isRank1 },
  { id: 'weekend',       icon: '\uD83C\uDFD6\uFE0F', cat: 'special', diamonds: 50,   check: s => { const d = new Date().getDay(); return (d === 0 || d === 6) && s.justSolved; } },
  // Level progress
  { id: 'easy_100',      icon: '\uD83C\uDF3F',   cat: 'levels', diamonds: 200,  check: s => s.levelEasy >= 100 },
  { id: 'easy_1000',     icon: '\uD83C\uDF3E',   cat: 'levels', diamonds: 1000, check: s => s.levelEasy >= 1000 },
  { id: 'medium_100',    icon: '\uD83D\uDD36',   cat: 'levels', diamonds: 300,  check: s => s.levelMedium >= 100 },
  { id: 'medium_1000',   icon: '\uD83D\uDD37',   cat: 'levels', diamonds: 1500, check: s => s.levelMedium >= 1000 },
  { id: 'hard_100',      icon: '\uD83D\uDD38',   cat: 'levels', diamonds: 500,  check: s => s.levelHard >= 100 },
  { id: 'hard_1000',     icon: '\uD83D\uDD39',   cat: 'levels', diamonds: 2000, check: s => s.levelHard >= 1000 },
  { id: 'hell_100',      icon: '\uD83D\uDD3A',   cat: 'levels', diamonds: 800,  check: s => s.levelHell >= 100 },
  { id: 'hell_1000',     icon: '\uD83D\uDD3B',   cat: 'levels', diamonds: 3000, check: s => s.levelHell >= 1000 },
  // Chapter milestones
  { id: 'chapter_1',     icon: '\uD83D\uDCD6',   cat: 'milestone', diamonds: 100,  check: s => s.chaptersCompleted >= 1 },
  { id: 'chapter_10',    icon: '\uD83D\uDCDA',   cat: 'milestone', diamonds: 500,  check: s => s.chaptersCompleted >= 10 },
  { id: 'chapter_50',    icon: '\uD83C\uDFF0',   cat: 'milestone', diamonds: 2000, check: s => s.chaptersCompleted >= 50 },
  { id: 'chapter_100',   icon: '\uD83C\uDF1F',   cat: 'milestone', diamonds: 5000, check: s => s.chaptersCompleted >= 100 },
  // World Conqueror (one per world)
  { id: 'conquer_easy',  icon: '\uD83C\uDF3F',   cat: 'special', diamonds: 2000,  check: s => s.levelEasy >= s.totalEasy && s.totalEasy > 0 },
  { id: 'conquer_medium',icon: '\uD83C\uDF0A',   cat: 'special', diamonds: 3000,  check: s => s.levelMedium >= s.totalMedium && s.totalMedium > 0 },
  { id: 'conquer_hard',  icon: '\uD83C\uDF0B',   cat: 'special', diamonds: 5000,  check: s => s.levelHard >= s.totalHard && s.totalHard > 0 },
  { id: 'conquer_hell',  icon: '\uD83C\uDF0C',   cat: 'special', diamonds: 10000, check: s => s.levelHell >= s.totalHell && s.totalHell > 0 },
  // Monthly: solve at least one puzzle in each month
  { id: 'month_1',  icon: '\u2744\uFE0F',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[0] },
  { id: 'month_2',  icon: '\uD83C\uDF38',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[1] },
  { id: 'month_3',  icon: '\uD83C\uDF31',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[2] },
  { id: 'month_4',  icon: '\uD83C\uDF27\uFE0F', cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[3] },
  { id: 'month_5',  icon: '\uD83C\uDF3B',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[4] },
  { id: 'month_6',  icon: '\u2600\uFE0F',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[5] },
  { id: 'month_7',  icon: '\uD83C\uDF34',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[6] },
  { id: 'month_8',  icon: '\uD83C\uDF1E',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[7] },
  { id: 'month_9',  icon: '\uD83C\uDF42',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[8] },
  { id: 'month_10', icon: '\uD83C\uDF83',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[9] },
  { id: 'month_11', icon: '\uD83C\uDF41',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[10] },
  { id: 'month_12', icon: '\uD83C\uDF84',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[11] },
  { id: 'spring',     icon: '\uD83C\uDF38', cat: 'monthly', diamonds: 200,  check: s => s.months && s.months[2] && s.months[3] && s.months[4] },
  { id: 'summer',     icon: '\u2600\uFE0F', cat: 'monthly', diamonds: 200,  check: s => s.months && s.months[5] && s.months[6] && s.months[7] },
  { id: 'autumn',     icon: '\uD83C\uDF42', cat: 'monthly', diamonds: 200,  check: s => s.months && s.months[8] && s.months[9] && s.months[10] },
  { id: 'winter',     icon: '\u2744\uFE0F', cat: 'monthly', diamonds: 200,  check: s => s.months && s.months[11] && s.months[0] && s.months[1] },
  { id: 'half_year',  icon: '\uD83C\uDF17', cat: 'monthly', diamonds: 500,  check: s => s.months && s.months.filter(Boolean).length >= 6 },
  { id: 'all_months', icon: '\uD83C\uDF0D', cat: 'monthly', diamonds: 1000, check: s => s.months && s.months.every(Boolean) },
];

function getUnlockedAchievements() {
  try { return JSON.parse(localStorage.getItem('octile_achievements') || '{}'); }
  catch { return {}; }
}

function saveUnlockedAchievements(data) {
  localStorage.setItem('octile_achievements', JSON.stringify(data));
}

function getStreak() {
  try {
    const data = JSON.parse(localStorage.getItem('octile_streak') || '{}');
    const today = new Date().toISOString().slice(0, 10);
    if (data.lastDate === today) return data;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (data.lastDate === yesterday) return { lastDate: today, count: data.count + 1 };
    return { lastDate: today, count: 1 };
  } catch { return { lastDate: new Date().toISOString().slice(0, 10), count: 1 }; }
}

function updateStreak() {
  const streak = getStreak();
  streak.lastDate = new Date().toISOString().slice(0, 10);
  localStorage.setItem('octile_streak', JSON.stringify(streak));
  return streak.count;
}

let achieveToastTimer = null;
function showAchieveToast(achievement) {
  if (_isPureMode) return; // Global kill switch
  // Disable in pure/D1/demo mode
  if (!_feature('achievements')) return;

  const toast = document.getElementById('achieve-toast');
  toast.querySelector('.toast-icon').textContent = achievement.icon;
  toast.querySelector('.toast-label').textContent = t('achieve_unlocked');
  toast.querySelector('.toast-name').textContent = t('ach_' + achievement.id);
  toast.classList.add('show');
  toast.style.cursor = 'pointer';
  toast.onclick = function() {
    toast.classList.remove('show');
    if (achieveToastTimer) { clearTimeout(achieveToastTimer); achieveToastTimer = null; }
    showGoalsModal('main');
  };
  playSound('achieve'); haptic([30, 20, 60]);
  setTimeout(function() { fxAchieveBurst(toast); }, 500);
  if (achieveToastTimer) clearTimeout(achieveToastTimer);
  achieveToastTimer = setTimeout(() => { toast.classList.remove('show'); achieveToastTimer = null; }, 3500);
}

function checkAchievements(stats) {
  // Disable in pure/D1/demo mode
  if (!_feature('achievements')) return [];

  const unlocked = getUnlockedAchievements();
  const newlyUnlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (unlocked[ach.id]) continue;
    if (ach.check(stats)) {
      unlocked[ach.id] = Date.now();
      newlyUnlocked.push(ach);
    }
  }
  if (newlyUnlocked.length) {
    saveUnlockedAchievements(unlocked);
    // Show toast for first new achievement (queue not needed for simplicity)
    showAchieveToast(newlyUnlocked[0]);
    // Show notification dot
    const dot = document.querySelector('.goals-dot');
    if (dot) dot.classList.add('show');
    // Add to message center
    for (var _mi = 0; _mi < newlyUnlocked.length; _mi++) {
      var _ach = newlyUnlocked[_mi];
      addMessage('achievement', _ach.icon, 'achieve_unlocked', 'ach_' + _ach.id, { achId: _ach.id });
    }
  }
  return newlyUnlocked;
}

let _achieveTab = 'main';

function _renderAchieveCards(filtered) {
  const unlocked = getUnlockedAchievements();
  const claimed = getClaimedAchievements();
  const grid = document.getElementById('achieve-grid');
  grid.innerHTML = '';
  for (const ach of filtered) {
    const isUnlocked = !!unlocked[ach.id];
    const isClaimed = !!claimed[ach.id];
    const progress = !isUnlocked ? _getAchievementProgress(ach) : 0;
    const isNearMiss = !isUnlocked && progress >= 0.8;
    const card = document.createElement('div');
    card.className = 'achieve-card ' + (isUnlocked ? 'unlocked' : 'locked') + (isNearMiss ? ' near-miss' : '');

    const iconDiv = document.createElement('div');
    iconDiv.className = 'achieve-icon';
    iconDiv.textContent = ach.icon;

    const nameDiv = document.createElement('div');
    nameDiv.className = 'achieve-name';
    nameDiv.textContent = t('ach_' + ach.id);

    const descDiv = document.createElement('div');
    descDiv.className = 'achieve-desc';
    descDiv.textContent = t('ach_' + ach.id + '_desc').replace('{total}', getEffectivePuzzleCount().toLocaleString());

    const expDiv = document.createElement('div');
    expDiv.className = 'achieve-exp';
    expDiv.textContent = '\uD83D\uDC8E ' + ach.diamonds;

    card.appendChild(iconDiv);
    card.appendChild(nameDiv);
    card.appendChild(descDiv);
    card.appendChild(expDiv);

    if (isNearMiss) {
      const nearDiv = document.createElement('div');
      nearDiv.className = 'achieve-near-miss-label';
      nearDiv.textContent = t('achieve_near_miss');
      card.appendChild(nearDiv);
    }

    if (isUnlocked) {
      if (isClaimed) {
        const claimedDiv = document.createElement('div');
        claimedDiv.className = 'achieve-claimed';
        claimedDiv.textContent = '\u2713 ' + t('ach_claimed');
        card.appendChild(claimedDiv);
      } else {
        const claimBtn = document.createElement('button');
        claimBtn.className = 'achieve-claim';
        claimBtn.textContent = t('ach_claim') + ' \uD83D\uDC8E' + ach.diamonds;
        claimBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          var diamonds = claimAchievementDiamonds(ach.id);
          _renderAchieveCards(filtered);
          renderAchieveModal();
          if (diamonds > 0) {
            showRewardModal({
              title: t('achieve_unlocked'),
              reason: t('ach_' + ach.id),
              rewards: [{ icon: '\uD83D\uDC8E', value: diamonds, label: t('ach_' + ach.id) }],
              primary: { text: t('reward_continue'), action: function() {} },
              secondary: { text: t('reward_view_goals'), action: function() { showGoalsModal('main'); } }
            });
          }
        });
        card.appendChild(claimBtn);
      }
      const dateDiv = document.createElement('div');
      dateDiv.className = 'achieve-date';
      dateDiv.textContent = new Date(unlocked[ach.id]).toLocaleDateString();
      card.appendChild(dateDiv);
    }

    grid.appendChild(card);
  }
}

function _renderProgressTab() {
  const grid = document.getElementById('achieve-grid');
  grid.innerHTML = '';

  // Fetch level totals if not loaded yet
  if (!_levelTotals.easy) {
    if (isOnline()) {
      grid.innerHTML = '<div style="text-align:center;color:#888;padding:20px">' + t('sb_loading') + '</div>';
      fetchLevelTotals().then(() => _renderProgressTab());
      return;
    }
    _levelTotals = {..._getOfflineTotals()};
  }

  const container = document.createElement('div');
  container.className = 'progress-levels';

  for (const level of LEVELS) {
    const total = getEffectiveLevelTotal(level);
    const completed = getLevelProgress(level);
    const pct = total > 0 ? (completed / total * 100) : 0;
    const color = LEVEL_COLORS[level];

    const card = document.createElement('div');
    card.className = 'progress-level-card';

    card.innerHTML = '<div class="progress-level-header">'
      + '<span class="progress-level-dot" style="background:' + color + '"></span>'
      + '<span class="progress-level-name">' + t('level_' + level) + '</span>'
      + '<span class="progress-level-count">' + completed + ' / ' + total + '</span>'
      + '</div>'
      + '<div class="progress-level-bar"><div class="progress-level-fill" style="width:' + Math.min(100, pct).toFixed(1) + '%;background:' + color + '"></div></div>'
      + '<div class="progress-level-pct">' + pct.toFixed(1) + '%</div>';

    container.appendChild(card);
  }

  // Total across all levels
  const totalAll = LEVELS.reduce((s, l) => s + getEffectiveLevelTotal(l), 0);
  const completedAll = LEVELS.reduce((s, l) => s + getLevelProgress(l), 0);
  const pctAll = totalAll > 0 ? (completedAll / totalAll * 100) : 0;

  const totalCard = document.createElement('div');
  totalCard.className = 'progress-level-card progress-total';
  totalCard.innerHTML = '<div class="progress-level-header">'
    + '<span class="progress-level-name">' + t('progress_total') + '</span>'
    + '<span class="progress-level-count">' + completedAll + ' / ' + totalAll + '</span>'
    + '</div>'
    + '<div class="progress-level-bar"><div class="progress-level-fill" style="width:' + Math.min(100, pctAll).toFixed(1) + '%;background:#3498db"></div></div>'
    + '<div class="progress-level-pct">' + pctAll.toFixed(1) + '%</div>';
  container.appendChild(totalCard);

  grid.appendChild(container);
}

function _getAchievementProgress(ach) {
  var stats = _getAchStatsForProgress();
  if (!stats) return 0;
  // Extract target from achievement id
  var m = ach.id.match(/(\d+)$/);
  if (!m) return 0;
  var target = parseInt(m[1]);
  if (!target) return 0;
  var current = 0;
  if (ach.cat === 'milestone' && ach.id.match(/^solve_/)) current = stats.unique || 0;
  else if (ach.cat === 'streak') current = stats.streak || 0;
  else if (ach.cat === 'dedication') current = stats.total || 0;
  else if (ach.id.match(/^easy_/)) current = stats.levelEasy || 0;
  else if (ach.id.match(/^medium_/)) current = stats.levelMedium || 0;
  else if (ach.id.match(/^hard_/)) current = stats.levelHard || 0;
  else if (ach.id.match(/^hell_/)) current = stats.levelHell || 0;
  else if (ach.id.match(/^chapter_/)) current = stats.chaptersCompleted || 0;
  else if (ach.id.match(/^total_/)) current = stats.total || 0;
  else return 0;
  return Math.min(1, current / target);
}

var _achStatsCache = null;
function _getAchStatsForProgress() {
  if (_achStatsCache) return _achStatsCache;
  try {
    var unique = 0;
    try { var ss = localStorage.getItem('octile_solved_set'); if (ss) { var p = JSON.parse(ss); unique = Array.isArray(p) ? p.length : Object.keys(p).length; } } catch(e) {}
    _achStatsCache = {
      unique: unique,
      total: parseInt(localStorage.getItem('octile_total_solved') || '0'),
      streak: (getStreak() || {}).count || 0,
      levelEasy: getLevelProgress('easy'),
      levelMedium: getLevelProgress('medium'),
      levelHard: getLevelProgress('hard'),
      levelHell: getLevelProgress('hell'),
      chaptersCompleted: getChaptersCompleted()
    };
  } catch(e) { _achStatsCache = {}; }
  return _achStatsCache;
}

function _renderTasksInGrid() {
  var grid = document.getElementById('achieve-grid');
  var data = getDailyTasks();
  updateDailyTaskProgress();
  data = getDailyTasks();
  var html = '<div class="tasks-in-goals">';
  html += '<div class="tasks-reset-line">' + t('tasks_reset').replace('{time}', getDailyTaskResetCountdown()) + '</div>';
  for (var i = 0; i < data.tasks.length; i++) {
    var task = data.tasks[i];
    var pct = Math.min(100, Math.round(task.progress / task.target * 100));
    var done = task.progress >= task.target;
    var cls = task.claimed ? 'task-card claimed' : done ? 'task-card completed' : 'task-card';
    html += '<div class="' + cls + '">';
    html += '<div class="task-name">' + t('task_' + task.id) + '</div>';
    html += '<div class="task-progress-bar"><div class="task-progress-fill" style="width:' + pct + '%"></div></div>';
    html += '<div class="task-footer">';
    html += '<span class="task-reward">\uD83D\uDC8E ' + task.reward + '</span>';
    var _dispProg = Number.isInteger(task.progress) ? task.progress : parseFloat(task.progress.toFixed(1));
    html += '<span>' + _dispProg + '/' + task.target + '</span>';
    if (task.claimed) {
      html += '<span class="task-claimed-tag">' + t('tasks_claimed') + '</span>';
    } else if (done) {
      html += '<button class="task-claim-btn" data-idx="' + i + '">' + t('tasks_claim') + '</button>';
    }
    html += '</div></div>';
  }
  // Bonus section
  if (data.bonusClaimed) {
    html += '<div class="tasks-bonus-line"><strong>' + t('tasks_bonus_claimed').replace('{diamonds}', DAILY_TASK_BONUS) + '</strong></div>';
  } else {
    html += '<div class="tasks-bonus-line">' + t('tasks_bonus').replace('{diamonds}', DAILY_TASK_BONUS) + '</div>';
  }
  html += '</div>';
  grid.innerHTML = html;
  // Bind claim buttons
  grid.querySelectorAll('.task-claim-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      claimDailyTaskReward(parseInt(this.getAttribute('data-idx')));
      _renderTasksInGrid();
      renderAchieveModal();
    });
  });
}

function _renderAchieveGrid(tab) {
  if (tab === 'tasks' && !_feature('daily_tasks')) {
    tab = 'main'; // redirect to achievements when daily_tasks is off
  }
  if (tab === 'tasks') {
    _renderTasksInGrid();
  } else if (tab === 'progress') {
    _renderProgressTab();
  } else if (tab === 'calendar') {
    _renderAchieveCards(ACHIEVEMENTS.filter(a => a.cat === 'monthly'));
  } else {
    var filtered = ACHIEVEMENTS.filter(a => a.cat !== 'monthly');
    var tier = (typeof getPlayerTier === 'function') ? getPlayerTier() : 'active';
    var unlocked = getUnlockedAchievements();
    var claimed = getClaimedAchievements();
    // Near-miss detection + sorting
    _achStatsCache = null; // reset cache
    filtered.sort(function(a, b) {
      var aUnlocked = !!unlocked[a.id], bUnlocked = !!unlocked[b.id];
      var aClaimed = !!claimed[a.id], bClaimed = !!claimed[b.id];
      var aProgress = aUnlocked ? 1 : _getAchievementProgress(a);
      var bProgress = bUnlocked ? 1 : _getAchievementProgress(b);
      var aNearMiss = !aUnlocked && aProgress >= 0.8;
      var bNearMiss = !bUnlocked && bProgress >= 0.8;
      // Unclaimed unlocked first, then near-miss, then locked, then claimed
      var aScore = aUnlocked && !aClaimed ? 0 : aNearMiss ? 1 : !aUnlocked ? 2 : 3;
      var bScore = bUnlocked && !bClaimed ? 0 : bNearMiss ? 1 : !bUnlocked ? 2 : 3;
      if (aScore !== bScore) return aScore - bScore;
      // Within near-miss, sort by proximity (higher progress first)
      if (aNearMiss && bNearMiss) return bProgress - aProgress;
      return 0;
    });
    _renderAchieveCards(filtered);
  }
}

function renderAchieveModal() {
  const unlocked = getUnlockedAchievements();
  const unlockedCount = Object.keys(unlocked).length;
  const totalCount = ACHIEVEMENTS.length;

  document.getElementById('achieve-modal-title').textContent = t('goals_title');
  // Summary: task progress + achievement count
  var _summaryHtml = '';
  if (_feature('daily_tasks')) {
    var taskData = getDailyTasks();
    var tasksDone = taskData.tasks ? taskData.tasks.filter(function(tk) { return tk.progress >= tk.target; }).length : 0;
    var tasksTotal = taskData.tasks ? taskData.tasks.length : 3;
    _summaryHtml += t('goals_tab_tasks') + ' ' + tasksDone + '/' + tasksTotal + ' &nbsp;·&nbsp; ';
  }
  _summaryHtml += t('achieve_summary').replace('{n}', unlockedCount).replace('{total}', totalCount) +
    ' &nbsp;\u2B50 ' + getExp().toLocaleString() + ' &nbsp;\uD83D\uDC8E ' + getDiamonds().toLocaleString();
  document.getElementById('achieve-summary').innerHTML = _summaryHtml;

  const tabs = document.getElementById('achieve-tabs');
  const tabLabels = {
    tasks: t('goals_tab_tasks'),
    main: t('achieve_tab_main'),
    progress: t('achieve_tab_progress'),
    calendar: t('achieve_tab_calendar'),
  };
  tabs.querySelectorAll('.achieve-tab').forEach(btn => {
    // Hide tasks tab when daily_tasks feature is off
    if (btn.dataset.tab === 'tasks' && !_feature('daily_tasks')) {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = '';
    btn.classList.toggle('active', btn.dataset.tab === _achieveTab);
    btn.textContent = tabLabels[btn.dataset.tab] || btn.dataset.tab;
  });

  _renderAchieveGrid(_achieveTab);
}

function showGoalsModal(tab) {
  _achieveTab = tab || (_feature('daily_tasks') ? 'tasks' : 'main');
  renderAchieveModal();
  // Clear notification dot
  var dot = document.querySelector('.goals-dot');
  if (dot) dot.classList.remove('show');
  document.getElementById('achieve-modal').classList.add('show');
}

function showAchieveModal() {
  showGoalsModal('main');
}

function renderWinAchievements(newlyUnlocked) {
  const el = document.getElementById('win-achievement');
  if (!newlyUnlocked.length) { el.innerHTML = ''; return; }
  let html = '<div class="win-badge-row">';
  for (const ach of newlyUnlocked) {
    html += '<div class="win-badge-item">' + ach.icon + ' ' + t('ach_' + ach.id) + '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// --- Unclaimed Reward Notifications ---
var _reminderShown = {};

function checkUnclaimedRewards() {
  // Disable entirely in pure/D1/demo mode
  if (!_feature('daily_checkin') && !_feature('daily_tasks') && !_feature('achievements')) return;

  var reasons = [];

  // 1. Daily check-in not done today (gated by feature flag)
  if (_feature('daily_checkin')) {
    var checkin = getDailyCheckin();
    var today = new Date().toISOString().slice(0, 10);
    if (checkin.lastDate !== today) {
      reasons.push({ icon: '\uD83D\uDC8E', key: 'reminder_checkin' });
    }
  }

  // 2. Daily tasks claimable (gated by feature flag)
  if (_feature('daily_tasks')) {
    var tasks = getDailyTasks();
    var claimableTasks = tasks.tasks && tasks.tasks.some(function(task) { return task.progress >= task.target && !task.claimed; });
    if (claimableTasks) {
      reasons.push({ icon: '\u2705', key: 'reminder_tasks' });
    }
  }

  // 3. Unclaimed achievement rewards
  if (_feature('achievements')) {
    var unlocked = getUnlockedAchievements();
    var claimed = getClaimedAchievements();
    var unclaimedAch = false;
    for (var achId in unlocked) {
      if (unlocked[achId] && !claimed[achId]) { unclaimedAch = true; break; }
    }
    if (unclaimedAch) {
      reasons.push({ icon: '\uD83C\uDFC6', key: 'reminder_achieve' });
    }
  }

  // Update settings dot
  var settingsDot = document.querySelector('#settings-btn .settings-dot');
  if (settingsDot) {
    settingsDot.classList.toggle('show', reasons.length > 0);
  }

  // Show one reminder toast per session (5s after load, don't repeat same key)
  if (!splashDismissed) return; // wait for splash
  for (var i = 0; i < reasons.length; i++) {
    var r = reasons[i];
    if (_reminderShown[r.key]) continue;
    _reminderShown[r.key] = true;
    showReminderToast(r.icon, r.key);
    break; // one at a time
  }
}

function renderTodayGoalCard() {
  var el = document.getElementById('wp-today-goal');
  if (!el) return;
  if (!_feature('today_goal')) { el.style.display = 'none'; return; }
  el.style.display = '';
  var data = getDailyTasks();
  var done = 0, total = 3;
  if (data.tasks) {
    total = data.tasks.length;
    for (var i = 0; i < data.tasks.length; i++) {
      if (data.tasks[i].progress >= data.tasks[i].target) done++;
    }
  }
  var totalSolved = parseInt(localStorage.getItem('octile_total_solved') || '0');
  var pct = total > 0 ? done / total : 0;
  var radius = 15, circ = 2 * Math.PI * radius;
  var offset = circ * (1 - pct);
  var strokeColor = done >= total ? '#2ecc71' : '#3498db';

  var text, hint;
  if (totalSolved < 10 && done === 0) {
    text = t('wp_goal_new');
    hint = '';
  } else if (done >= total) {
    text = t('wp_goal_done');
    hint = '';
  } else {
    text = t('wp_goal_progress').replace('{done}', done).replace('{total}', total);
    // Find next unclaimed task reward
    var nextReward = 0;
    if (data.tasks) {
      for (var j = 0; j < data.tasks.length; j++) {
        if (data.tasks[j].progress < data.tasks[j].target) { nextReward = data.tasks[j].reward; break; }
      }
    }
    hint = nextReward > 0 ? t('wp_goal_hint').replace('{diamonds}', nextReward) : '';
  }

  el.innerHTML = '<svg class="goal-ring" viewBox="0 0 40 40">'
    + '<circle cx="20" cy="20" r="' + radius + '" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3"/>'
    + '<circle class="goal-ring-progress" cx="20" cy="20" r="' + radius + '" fill="none" stroke="' + strokeColor + '" stroke-width="3" stroke-linecap="round"'
    + ' stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" transform="rotate(-90 20 20)"/>'
    + '<text x="20" y="24" text-anchor="middle" fill="#eee" font-size="12" font-weight="700">' + done + '/' + total + '</text>'
    + '</svg>'
    + '<div class="goal-text-wrap"><div class="goal-text">' + text + '</div>'
    + (hint ? '<div class="goal-hint">' + hint + '</div>' : '')
    + '</div>';
  el.onclick = function() { showGoalsModal('tasks'); };
}

// --- Daily Challenge Card (Steam-exclusive) ---
var _isDailyChallenge = false;
var _dailyChallengeLevel = null;
var _dailyDate = null;

function _dcTryKey(date, level) { return 'octile_daily_try_' + date + '_' + level; }
function _dcDoneKey(date, level) { return 'octile_daily_done_' + date + '_' + level; }

function _dcHasTryOrDone(date, level) {
  return !!_dcGetTry(date, level) || !!_dcGetDone(date, level);
}

function _dcGetTry(date, level) {
  try {
    var data = JSON.parse(localStorage.getItem(_dcTryKey(date, level)));
    if (!data) return null;
    // Grandfather legacy entries: migrate v==null to v:2 if data looks valid
    if (data.v == null) {
      var looksValid = typeof data.puzzle === 'number' && data.puzzle > 0;
      if (!looksValid) return null;
      console.warn('[DC] Legacy try entry detected, migrating to v:2', data);
      data.v = 2;
      localStorage.setItem(_dcTryKey(date, level), JSON.stringify(data));
    }
    // Reject entries with wrong version
    if (data.v < 2) return null;
    return data;
  }
  catch { return null; }
}

function _dcGetDone(date, level) {
  try {
    var data = JSON.parse(localStorage.getItem(_dcDoneKey(date, level)));
    if (!data) return null;
    // Grandfather legacy entries: migrate v==null to v:2 if data looks valid
    if (data.v == null) {
      var looksValid =
        typeof data.puzzle === 'number' && data.puzzle > 0 &&
        typeof data.time === 'number' && data.time > 0 &&
        typeof data.grade === 'string' && data.grade.length > 0;
      if (!looksValid) return null;
      console.warn('[DC] Legacy done entry detected, migrating to v:2', data);
      data.v = 2;
      localStorage.setItem(_dcDoneKey(date, level), JSON.stringify(data));
    }
    // Reject entries with wrong version
    if (data.v < 2) return null;
    return data;
  }
  catch { return null; }
}

function getDailyChallengeStreak() {
  try { return JSON.parse(localStorage.getItem('octile_daily_streak') || '{"count":0,"lastDate":""}'); }
  catch { return { count: 0, lastDate: '' }; }
}

function updateDailyChallengeStreak(date) {
  // Client-authoritative by design
  var streak = getDailyChallengeStreak();
  if (streak.lastDate === date) return streak; // already updated today
  var yesterday = new Date(new Date(date + 'T00:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
  if (streak.lastDate === yesterday) {
    streak.count += 1;
  } else {
    streak.count = 1;
  }
  streak.lastDate = date;
  localStorage.setItem('octile_daily_streak', JSON.stringify(streak));
  return streak;
}

function renderDailyChallengeCard() {
  var el = document.getElementById('wp-daily-challenge');
  if (!el) return;

  // Always hide first to prevent flash
  el.style.display = 'none';

  // Do not render until config is ready (prevents flash in Demo/Pure)
  if (!_configLoaded) return;

  // Steam build only + feature-gated (Demo/Pure have daily_challenge=false)
  // TODO: Re-enable Steam check before release
  // if (!window.steam || !_feature('daily_challenge')) return;
  if (!_feature('daily_challenge')) return;

  // Only now render content + show card
  el.style.display = '';
  var date = getDailyChallengeDate();

  // Check if FullPack is ready (required for DC)
  var packReady = !!(_fullPackReader && _fullPackReader.hasOrdering);

  if (!packReady) {
    el.innerHTML = '<div class="dc-header"><span class="dc-icon">&#9728;&#65039;</span><span class="dc-title">' + t('daily_challenge') + '</span></div>'
      + '<div class="dc-offline">' + t('dc_downloading') + '</div>';
    el.classList.add('dc-disabled');
    return;
  }
  el.classList.remove('dc-disabled');

  var rows = '';
  var doneCount = 0;
  var levels = ['easy', 'medium', 'hard', 'hell'];
  for (var i = 0; i < levels.length; i++) {
    var lv = levels[i];
    var dot = LEVEL_DOTS[lv];
    var slot = getDailyChallengeSlot(date, lv);
    var done = _dcGetDone(date, lv);
    var tried = !!_dcGetTry(date, lv);

    rows += '<div class="daily-row';
    if (done) {
      rows += ' daily-row-done';
      doneCount++;
    } else if (tried) {
      rows += ' daily-row-locked';
    }
    rows += '">';

    if (done) {
      // Completed: dot + level + time + grade + leaderboard button
      rows += '<span class="daily-dot">' + (!_feature('daily_challenge_rewards') ? dot : '&#10003;') + '</span>';
      rows += '<span class="daily-level">' + t('level_' + lv) + '</span>';
      rows += '<span class="daily-result">' + sbFormatTime(done.time) + ' <span class="daily-grade daily-grade-' + done.grade + '">' + done.grade + '</span></span>';
      rows += '<button class="daily-action daily-lb-btn" data-level="' + lv + '" title="' + t('daily_challenge_leaderboard') + '">&#128202;</button>';
    } else if (tried) {
      // Attempted but not completed: lock
      rows += '<span class="daily-dot">' + dot + '</span>';
      rows += '<span class="daily-level">' + t('level_' + lv) + '</span>';
      rows += '<span class="daily-slot">#' + slot + '</span>';
      rows += '<span class="daily-result daily-attempted">' + t('daily_challenge_locked') + '</span>';
      rows += '<span class="daily-action daily-lock-icon">&#128274;</span>';
    } else {
      // Not attempted: play button
      rows += '<span class="daily-dot">' + dot + '</span>';
      rows += '<span class="daily-level">' + t('level_' + lv) + '</span>';
      rows += '<span class="daily-slot">#' + slot + '</span>';
      rows += '<span class="daily-result"></span>';
      rows += '<button class="daily-action daily-play-btn" data-level="' + lv + '">' + t('daily_challenge_play') + ' &#9654;</button>';
    }
    rows += '</div>';
  }

  // Footer: different states for 4/4 complete vs in-progress
  var streak = getDailyChallengeStreak();
  var footer = '';
  if (doneCount >= 4) {
    // All complete: celebration state + glow
    el.classList.add('dc-all-done');
    footer = '<div class="dc-complete-banner">'
      + '<div class="dc-complete-text">&#127881; ' + t(!_feature('daily_challenge_rewards') ? 'daily_challenge_all_done_steam' : 'daily_challenge_all_done') + '</div>';
    if (_feature('daily_challenge_rewards')) footer += '<div class="dc-complete-sub">' + t('daily_challenge_bonus') + '</div>';
    if (streak.count > 0) {
      footer += '<div class="dc-complete-streak">&#128293; ' + t('daily_challenge_streak').replace('{n}', streak.count) + '</div>';
    }
    footer += '<div class="dc-complete-cta">' + t('daily_challenge_check_rank') + '</div>';
    footer += '</div>';
  } else {
    el.classList.remove('dc-all-done');
    footer = '<div class="dc-footer">';
    if (streak.count > 0) {
      footer += '<span class="dc-streak">&#128293; ' + t('daily_challenge_streak').replace('{n}', streak.count) + '</span>';
    }
    if (_feature('daily_challenge_rewards')) {
      footer += '<span class="dc-completed">' + t('daily_challenge_completed_count').replace('{n}', doneCount) + '</span>';
    }
    footer += '</div>';
    footer += '<div class="dc-hint">' + t('daily_challenge_one_attempt') + '</div>';
  }

  el.innerHTML = '<div class="dc-header"><span class="dc-icon">&#9728;&#65039;</span><span class="dc-title">' + t('daily_challenge') + '</span></div>'
    + '<div class="dc-rows">' + rows + '</div>' + footer;

  // Bind play buttons
  el.querySelectorAll('.daily-play-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      startDailyChallenge(btn.dataset.level);
    });
  });
  // Bind leaderboard buttons
  el.querySelectorAll('.daily-lb-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      showDailyChallengeLeaderboard(btn.dataset.level);
    });
  });
}

// --- Unified Reward Modal ---
// showRewardModal({ title, reason, rewards: [{icon, value, label}], primary: {text, action}, secondary: {text, action} })
function showRewardModal(opts) {
  var modal = document.getElementById('reward-modal');
  document.getElementById('reward-title').textContent = opts.title || t('reward_title_default');
  document.getElementById('reward-reason').textContent = opts.reason || '';
  document.getElementById('reward-reason').style.display = opts.reason ? '' : 'none';

  // Reward lines with animated counters
  var listEl = document.getElementById('reward-list');
  listEl.innerHTML = '';
  var rewards = opts.rewards;
  if (rewards === null || rewards === undefined) rewards = [];
  if (rewards.length === 0 && !opts.hideRewards) {
    listEl.innerHTML = '<div class="reward-line" style="color:#888;font-size:13px">' + t('reward_progress_updated') + '</div>';
  }
  listEl.style.display = opts.hideRewards ? 'none' : '';
  for (var i = 0; i < rewards.length && i < 3; i++) {
    var r = rewards[i];
    var line = document.createElement('div');
    line.className = 'reward-line';
    line.style.animationDelay = (i * 0.15) + 's';
    var iconSpan = document.createElement('span');
    iconSpan.className = 'reward-icon';
    iconSpan.textContent = r.icon || '';
    var valSpan = document.createElement('span');
    valSpan.className = 'reward-value';
    valSpan.textContent = '+' + (r.value || 0);
    var labelSpan = document.createElement('span');
    labelSpan.style.cssText = 'font-size:13px;color:#aaa;font-weight:400';
    labelSpan.textContent = r.label || '';
    line.appendChild(iconSpan);
    line.appendChild(valSpan);
    if (r.label) line.appendChild(labelSpan);
    listEl.appendChild(line);
    // Animate counter from 0
    (function(el, target) {
      var start = performance.now(), dur = 600;
      function tick(now) {
        var p = Math.min((now - start) / dur, 1);
        p = 1 - Math.pow(1 - p, 3);
        el.textContent = '+' + Math.round(target * p).toLocaleString();
        if (p < 1) requestAnimationFrame(tick);
      }
      if (target > 0) requestAnimationFrame(tick);
    })(valSpan, r.value || 0);
  }

  // Primary CTA
  var primaryBtn = document.getElementById('reward-primary');
  primaryBtn.textContent = (opts.primary && opts.primary.text) || t('reward_continue');
  primaryBtn.onclick = function() {
    modal.classList.remove('show');
    if (opts.primary && opts.primary.action) opts.primary.action();
  };

  // Secondary link
  var secEl = document.getElementById('reward-secondary');
  if (opts.secondary) {
    secEl.textContent = opts.secondary.text;
    secEl.style.display = '';
    secEl.onclick = function() {
      modal.classList.remove('show');
      if (opts.secondary.action) opts.secondary.action();
    };
  } else {
    secEl.style.display = 'none';
  }

  // Backdrop click = primary action
  modal.onclick = function(e) {
    if (e.target === modal) {
      modal.classList.remove('show');
      if (opts.primary && opts.primary.action) opts.primary.action();
    }
  };

  modal.classList.add('show');
}

function showReminderToast(icon, labelKey) {
  if (_isPureMode) return; // Global kill switch
  var toast = document.getElementById('achieve-toast');
  if (!toast || toast.classList.contains('show')) return;
  toast.querySelector('.toast-icon').textContent = icon;
  toast.querySelector('.toast-label').textContent = t('reminder_title');
  toast.querySelector('.toast-name').textContent = t(labelKey);
  toast.classList.add('show');
  toast.style.cursor = 'pointer';
  toast.onclick = function() {
    toast.classList.remove('show');
    if (achieveToastTimer) { clearTimeout(achieveToastTimer); achieveToastTimer = null; }
    if (labelKey === 'reminder_tasks') showGoalsModal('tasks');
    else if (labelKey === 'reminder_achieve') showGoalsModal('main');
    else if (labelKey === 'reminder_checkin') showGoalsModal('tasks');
  };
  playSound('toast');
  if (achieveToastTimer) clearTimeout(achieveToastTimer);
  achieveToastTimer = setTimeout(function() { toast.classList.remove('show'); achieveToastTimer = null; }, 4000);
}

// --- World Scoreboard ---
let SB_API = WORKER_URL + '/scoreboard';
var SB_CACHE_MS = 180000;  // overridden by config.json scoreboardCacheMs
const sbCache = {};

async function sbFetch(params) {
  const key = JSON.stringify(params);
  const now = Date.now();
  if (sbCache[key] && now - sbCache[key].ts < SB_CACHE_MS) return sbCache[key].data;
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(SB_API + '?' + qs);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  sbCache[key] = { data, ts: now };
  return data;
}

function sbLoading() {
  return '<div class="sb-loading"><div class="sb-spinner"></div>' + t('sb_loading') + '</div>';
}
function sbError(retryFn) {
  return '<div class="sb-error"><div class="sb-error-icon">⚠️</div><div>' + t('sb_error') + '</div><button class="sb-retry" data-retry="' + escapeHtml(retryFn) + '">' + t('sb_retry') + '</button></div>';
}
function _bindRetryButtons(container) {
  container.querySelectorAll('.sb-retry[data-retry]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var fn = btn.getAttribute('data-retry');
      if (/^[a-zA-Z_]+\([^)]*\)$/.test(fn)) { (new Function(fn))(); }
    });
  });
}
function sbEmpty(msg) {
  return '<div class="sb-empty"><div class="sb-empty-icon">🏆</div><div>' + msg + '</div></div>';
}

function _safePictureUrl(input) {
  if (!input || typeof input !== 'string') return '';
  try {
    var u = new URL(input);
    if (u.protocol !== 'https:') return '';
    return u.toString();
  } catch(e) { return ''; }
}

function sbAvatarHTML(uuid, size, picture) {
  var safePic = _safePictureUrl(picture);
  if (safePic) {
    return '<div class="sb-avatar" style="width:' + size + 'px;height:' + size + 'px"><img src="' + escapeHtml(safePic) + '" width="' + size + '" height="' + size + '" style="border-radius:' + Math.round(size * 0.22) + 'px;object-fit:cover" referrerpolicy="no-referrer"></div>';
  }
  return '<div class="sb-avatar" style="width:' + size + 'px;height:' + size + 'px">' + generateAvatar(uuid, size) + '</div>';
}

function escapeHtml(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function sbDisplayName(uuid, serverName) {
  if (serverName) return serverName;
  var authUser = getAuthUser();
  if (authUser && authUser.display_name && uuid === getBrowserUUID()) return authUser.display_name;
  return generateCuteName(uuid);
}

function sbPicture(uuid, serverPicture) {
  if (serverPicture) return serverPicture;
  var authUser = getAuthUser();
  if (authUser && authUser.picture && uuid === getBrowserUUID()) return authUser.picture;
  return null;
}

function sbFormatTime(sec) {
  if (sec < 60) return sec.toFixed(1) + 's';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function updateOnlineUI() {
  const btn = document.getElementById('scoreboard-btn');
  if (!isOnline()) {
    btn.style.opacity = '0.35';
    btn.style.pointerEvents = 'none';
  } else {
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
  }
}

function showScoreboardModal() {
  if (!_feature('scoreboard')) return; // no global scoreboard
  if (!isOnline()) return;
  // Hide league tab for anonymous users or when league feature is off
  document.getElementById('sb-tab-league').style.display = (_feature('league') && isAuthenticated()) ? '' : 'none';
  _maybeShowSignInHint();
  document.getElementById('scoreboard-modal').classList.add('show');
  // Activate first tab
  switchSbTab('global');
}

function switchSbTab(tab) {
  document.querySelectorAll('.sb-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.sb-tab-content').forEach(p => p.classList.toggle('active', p.id === 'sb-panel-' + tab));
  if (tab === 'global') renderGlobalTab();
  else if (tab === 'puzzle') renderPuzzleTab();
  else if (tab === 'me') renderMyStatsTab();
  else if (tab === 'league') renderLeagueTab();
}

async function renderGlobalTab() {
  const panel = document.getElementById('sb-panel-global');
  panel.innerHTML = sbLoading();
  try {
    const res = await fetch(WORKER_URL + '/leaderboard?limit=' + LEADERBOARD_LIMIT, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const ranked = data.leaderboard || [];
    if (!ranked.length) { panel.innerHTML = sbEmpty(t('sb_no_scores')); return; }
    const myUUID = getBrowserUUID();
    const myIdx = ranked.findIndex(p => p.browser_uuid === myUUID);
    const totalPlayers = data.total_players || ranked.length;

    let html = '';
    // My rank card
    if (myIdx >= 0) {
      const me = ranked[myIdx];
      const pct = Math.max(1, Math.round((myIdx + 1) / totalPlayers * 100));
      html += '<div class="sb-my-rank">';
      html += sbAvatarHTML(myUUID, 40, sbPicture(myUUID, me.picture));
      html += '<div class="sb-my-info"><div class="sb-my-name">' + sbDisplayName(myUUID, me.display_name) + '</div>';
      html += '<div class="sb-my-detail">⭐ ' + (me.total_exp || 0).toLocaleString() + ' · ' + me.puzzles + ' ' + t('sb_puzzles') + ' · ' + sbFormatTime(me.avg_time) + ' ' + t('sb_avg') + '</div></div>';
      html += '<div class="sb-rank-badge"><div class="sb-rank-num">#' + (myIdx + 1) + '</div><div class="sb-rank-pct">' + t('sb_top').replace('{pct}', pct) + '</div></div>';
      html += '</div>';
    }
    html += '<div class="sb-summary">' + t('sb_total_players').replace('{n}', totalPlayers) + ' · ' + t('sb_all_time') + '</div>';
    // Leaderboard
    html += '<div class="sb-list">';
    const show = Math.min(ranked.length, 50);
    for (let i = 0; i < show; i++) {
      const p = ranked[i];
      const isMe = p.browser_uuid === myUUID;
      const crown = i < 3 ? ' sb-crown' : '';
      const me = isMe ? ' sb-me' : '';
      const posLabel = i === 0 ? '\uD83D\uDC51' : i === 1 ? '\uD83E\uDD48' : i === 2 ? '\uD83E\uDD49' : '#' + (i + 1);
      html += '<div class="sb-row' + crown + me + '">';
      html += '<div class="sb-pos">' + posLabel + '</div>';
      html += sbAvatarHTML(p.browser_uuid, 32, sbPicture(p.browser_uuid, p.picture));
      html += '<div class="sb-name">' + sbDisplayName(p.browser_uuid, p.display_name) + (isMe ? ' (' + t('sb_you') + ')' : '') + '</div>';
      html += '<div class="sb-val"><strong>⭐ ' + (p.total_exp || 0).toLocaleString() + '</strong></div>';
      html += '<div class="sb-val">' + p.puzzles + ' ' + t('sb_puzzles') + '</div>';
      html += '</div>';
    }
    html += '</div>';
    panel.innerHTML = html;
  } catch (e) {
    console.warn('[Octile] Scoreboard fetch failed:', e.message);
    panel.innerHTML = sbError('renderGlobalTab()'); _bindRetryButtons(panel);
  }
}

async function renderPuzzleTab() {
  const panel = document.getElementById('sb-panel-puzzle');
  const puzzleNum = currentPuzzleNumber;
  document.getElementById('sb-tab-puzzle').textContent = t('sb_tab_puzzle').replace('{n}', puzzleNum);
  panel.innerHTML = sbLoading();
  try {
    const data = await sbFetch({ puzzle: String(puzzleNum), best: 'true', limit: '50' });
    const scores = data.scores || [];
    if (!scores.length) { panel.innerHTML = sbEmpty(t('sb_no_puzzle_scores')); return; }
    const myUUID = getBrowserUUID();
    let html = '<div class="sb-summary">' + t('sb_puzzle_header').replace('{n}', puzzleNum).replace('{total}', data.total || scores.length) + '</div>';
    html += '<div class="sb-list">';
    for (let i = 0; i < scores.length; i++) {
      const s = scores[i];
      const isMe = s.browser_uuid === myUUID;
      const crown = i < 3 ? ' sb-crown' : '';
      const me = isMe ? ' sb-me' : '';
      const posLabel = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
      html += '<div class="sb-row' + crown + me + '">';
      html += '<div class="sb-pos">' + posLabel + '</div>';
      html += sbAvatarHTML(s.browser_uuid, 32, sbPicture(s.browser_uuid, s.picture));
      html += '<div class="sb-name">' + sbDisplayName(s.browser_uuid, s.display_name) + (isMe ? ' (' + t('sb_you') + ')' : '') + '</div>';
      html += '<div class="sb-val"><strong>' + sbFormatTime(s.resolve_time) + '</strong></div>';
      html += '</div>';
    }
    html += '</div>';
    panel.innerHTML = html;
  } catch (e) {
    console.warn('[Octile] Puzzle scoreboard failed:', e.message);
    panel.innerHTML = sbError('renderPuzzleTab()'); _bindRetryButtons(panel);
  }
}

async function renderMyStatsTab() {
  const panel = document.getElementById('sb-panel-me');
  const myUUID = getBrowserUUID();
  panel.innerHTML = sbLoading();
  try {
    const data = await sbFetch({ uuid: myUUID, best: 'true', limit: '200' });
    const scores = data.scores || [];
    // Profile header
    var myPic = sbPicture(myUUID, null);
    let html = '<div class="sb-profile">';
    var safePic = _safePictureUrl(myPic);
    html += '<div class="sb-avatar-lg">' + (safePic ? '<img src="' + escapeHtml(safePic) + '" width="80" height="80" style="border-radius:18px;object-fit:cover" referrerpolicy="no-referrer">' : generateAvatar(myUUID, 80)) + '</div>';
    html += '<div class="sb-profile-name">' + sbDisplayName(myUUID, null) + '</div>';
    html += '<div class="sb-profile-id">ID: ' + myUUID.slice(0, 4) + '...' + myUUID.slice(-4) + '</div>';
    html += '</div>';

    const totalPuzzles = scores.length;
    const totalTime = scores.reduce((sum, s) => sum + s.resolve_time, 0);
    const avgTime = totalPuzzles > 0 ? totalTime / totalPuzzles : 0;
    const bestScore = scores.reduce((best, s) => s.resolve_time < best.resolve_time ? s : best, scores[0] || { resolve_time: 0, puzzle_number: '-' });
    const totalSolves = parseInt(localStorage.getItem('octile_total_solved') || '0');

    // Stats grid
    html += '<div class="sb-stats-grid">';
    html += '<div class="sb-stat-card"><div class="sb-stat-val">' + totalPuzzles + '</div><div class="sb-stat-label">' + t('sb_stat_puzzles') + '</div></div>';
    html += '<div class="sb-stat-card"><div class="sb-stat-val">' + (avgTime > 0 ? sbFormatTime(avgTime) : '-') + '</div><div class="sb-stat-label">' + t('sb_stat_avg') + '</div></div>';
    html += '<div class="sb-stat-card"><div class="sb-stat-val">' + (bestScore && bestScore.resolve_time ? sbFormatTime(bestScore.resolve_time) : '-') + '</div><div class="sb-stat-label">' + t('sb_stat_best') + '</div><div class="sb-stat-sub">' + (bestScore && bestScore.puzzle_number ? '#' + bestScore.puzzle_number : '') + '</div></div>';
    html += '<div class="sb-stat-card"><div class="sb-stat-val">' + totalSolves + '</div><div class="sb-stat-label">' + t('sb_stat_total') + '</div></div>';
    html += '</div>';

    // Recent solves
    if (scores.length > 0) {
      const recent = [...scores].sort((a, b) => new Date(b.created_at || b.timestamp_utc) - new Date(a.created_at || a.timestamp_utc)).slice(0, 10);
      html += '<div class="sb-recent"><h4>' + t('sb_recent') + '</h4>';
      for (const s of recent) {
        html += '<div class="sb-recent-item"><span>' + t('sb_puzzle_label') + ' #' + s.puzzle_number + '</span><span>' + sbFormatTime(s.resolve_time) + '</span></div>';
      }
      html += '</div>';
    } else {
      html += sbEmpty(t('sb_no_my_scores'));
    }
    panel.innerHTML = html;
  } catch (e) {
    console.warn('[Octile] My stats failed:', e.message);
    panel.innerHTML = sbError('renderMyStatsTab()'); _bindRetryButtons(panel);
  }
}

// --- Team League Tab ---

var LEAGUE_TIERS_CLIENT = [
  { icon: '\uD83D\uDFE4', name: 'Bronze' },
  { icon: '\u26AA', name: 'Silver' },
  { icon: '\uD83D\uDFE1', name: 'Gold' },
  { icon: '\uD83D\uDD35', name: 'Sapphire' },
  { icon: '\uD83D\uDD34', name: 'Ruby' },
  { icon: '\uD83D\uDFE2', name: 'Emerald' },
  { icon: '\uD83D\uDFE3', name: 'Amethyst' },
  { icon: '\u26AB', name: 'Obsidian' }
];

function leagueSettlementCountdown() {
  // Time until 00:05 UTC
  var now = new Date();
  var target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
  var diff = Math.floor((target - now) / 1000);
  var h = Math.floor(diff / 3600);
  var m = Math.floor((diff % 3600) / 60);
  return h + 'h ' + m + 'm';
}

async function renderLeagueTab() {
  var panel = document.getElementById('sb-panel-league');
  if (!navigator.onLine) {
    panel.innerHTML = '<div class="league-prompt">'
      + '<div class="league-prompt-icon">\uD83D\uDCF6</div>'
      + '<div class="league-prompt-title">' + t('league_title') + '</div>'
      + '<div class="league-prompt-desc">' + t('league_offline') + '</div>'
      + '</div>';
    return;
  }
  if (!isAuthenticated()) {
    panel.innerHTML = '<div class="league-prompt">'
      + '<div class="league-prompt-icon">\uD83D\uDC8E</div>'
      + '<div class="league-prompt-title">' + t('league_title') + '</div>'
      + '<div class="league-prompt-desc">' + t('league_signin_prompt') + '</div>'
      + '<button class="league-signin-btn" onclick="showAuthModal()">' + t('auth_signin') + '</button>'
      + '</div>';
    return;
  }
  panel.innerHTML = '<div style="text-align:center;padding:40px;color:#666">' + t('league_loading') + '</div>';
  try {
    var res = await fetch(WORKER_URL + '/league/my-team', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('octile_auth_token') }
    });
    var data = await res.json();
    if (data.status === 'not_joined' || data.status === 'no_team') {
      panel.innerHTML = '<div class="league-prompt">'
        + '<div class="league-prompt-icon">\uD83D\uDC8E</div>'
        + '<div class="league-prompt-title">' + t('league_title') + '</div>'
        + '<div class="league-prompt-desc">' + t('league_join_desc') + '</div>'
        + '<button class="league-join-btn" id="league-join-btn">' + t('league_join_btn') + '</button>'
        + '</div>';
      document.getElementById('league-join-btn').addEventListener('click', leagueJoin);
      return;
    }
    if (data.status !== 'ok') throw new Error(data.status);
    panel.innerHTML = renderLeagueTeamView(data);

    // Detect tier change for message center
    var cachedTier = parseInt(localStorage.getItem('octile_league_tier') || '-1');
    if (cachedTier >= 0 && data.tier !== cachedTier) {
      var tierName = t('league_tier_' + data.tier);
      if (data.tier > cachedTier) {
        addMessage('league', '\uD83D\uDD3A', 'league_promoted_title', 'league_promoted_body', { tier: tierName });
        showRewardModal({
          title: t('league_promoted_title'),
          reason: t('league_promoted_body').replace('{tier}', tierName),
          rewards: [],
          primary: { text: t('reward_continue'), action: function() {} }
        });
      } else {
        addMessage('league', '\uD83D\uDD3B', 'league_demoted_title', 'league_demoted_body', { tier: tierName });
        addClaimableMultiplier(2);
      }
    }
    localStorage.setItem('octile_league_tier', data.tier);
  } catch (e) {
    console.warn('[Octile] League fetch failed:', e.message);
    panel.innerHTML = '<div style="text-align:center;padding:40px;color:#666">' + t('league_error') + '</div>';
  }
}

function renderLeagueTeamView(data) {
  var tierInfo = LEAGUE_TIERS_CLIENT[data.tier] || LEAGUE_TIERS_CLIENT[0];
  var html = '';

  // Tier header
  var safeTierColor = /^#[0-9a-fA-F]{3,6}$/.test(data.tier_color) ? data.tier_color : '#888';
  html += '<div class="league-tier-header" style="--tier-color:' + safeTierColor + '">';
  html += '<div class="league-tier-badge">' + tierInfo.icon + '</div>';
  html += '<div class="league-tier-name">' + t('league_tier_' + data.tier) + '</div>';
  html += '</div>';

  // Settlement countdown
  html += '<div class="league-countdown">' + t('league_resets_in').replace('{time}', leagueSettlementCountdown()) + '</div>';

  // Promotion/demotion streak or waiting message
  var _needMore = data.active_count < (data.min_active || 3);
  if (_needMore) {
    html += '<div class="league-streak" style="background:rgba(241,196,15,0.1);color:#f0e68c">\u23F3 ' + t('league_waiting').replace('{n}', (data.min_active || 3) - data.active_count) + '</div>';
  } else if (data.promo_streak > 0) {
    html += '<div class="league-streak league-promo">\uD83D\uDD3A ' + t('league_promo_streak').replace('{n}', data.promo_streak).replace('{req}', 3) + '</div>';
  } else if (data.demote_streak > 0) {
    html += '<div class="league-streak league-demote">\uD83D\uDD3B ' + t('league_demote_streak').replace('{n}', data.demote_streak).replace('{req}', 3) + '</div>';
  }

  // Team label
  html += '<div class="league-team-label">' + t('league_today_exp') + ' \u2014 ' + escapeHtml(data.team_name || '') + '</div>';

  // Member list
  html += '<div class="sb-list">';
  var authUser = getAuthUser();
  var myId = authUser ? authUser.id : null;
  var totalExp = 0;
  var activeCount = 0;

  for (var i = 0; i < data.members.length; i++) {
    var m = data.members[i];
    var isMe = m.user_id === myId;
    var isTop2 = i < 2;
    var isInactive = (m.inactive_days || 0) >= 2;
    var cls = 'sb-row';
    if (isMe) cls += ' sb-me';
    if (isTop2 && !isInactive) cls += ' league-top2';
    if (isInactive) cls += ' league-inactive';

    var posIcon = i === 0 ? '\uD83E\uDD47' : i === 1 ? '\uD83E\uDD48' : i === 2 ? '\uD83E\uDD49' : '#' + (i + 1);

    html += '<div class="' + cls + '">';
    html += '<div class="sb-pos">' + posIcon + '</div>';
    html += sbAvatarHTML(m.user_id, 32, m.picture);
    html += '<div class="sb-name">' + escapeHtml(m.display_name || 'Player') + (isMe ? ' (' + t('sb_you') + ')' : '') + (isInactive ? ' <span style="color:#666;font-size:11px">' + t('league_inactive') + '</span>' : '') + '</div>';
    html += '<div class="sb-val"><strong>\u2B50 ' + (m.exp_today || 0).toLocaleString() + '</strong></div>';
    html += '</div>';

    totalExp += m.exp_today || 0;
    if (!isInactive) activeCount++;
  }
  html += '</div>';

  // Average line (excluding inactive)
  var avgExp = activeCount > 0 ? Math.round(totalExp / activeCount) : 0;
  html += '<div class="league-avg-line">' + t('league_avg') + ': \u2B50 ' + avgExp.toLocaleString() + '</div>';

  return html;
}

async function leagueJoin() {
  try {
    var res = await fetch(WORKER_URL + '/league/join', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('octile_auth_token'), 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    localStorage.setItem('octile_league_tier', data.tier || 0);
    addMessage('league', '\uD83D\uDC8E', 'league_joined_title', 'league_joined_body', {});
    renderLeagueTab();
  } catch (e) {
    console.warn('[Octile] League join failed:', e.message);
  }
}

// --- Encouragement Toasts (during gameplay) ---
var _encourageShown = false;
var _lastPlaceTime = 0;
function maybeShowEncourageToast() {
  // disable all toast
  return;
  if (_encourageShown || gameOver) return;
  if (!localStorage.getItem('octile_onboarded')) return; // skip first-timer
  if (Math.random() > 0.3) return; // 30% chance
  var placed = piecesPlacedCount;
  var msgs;
  var now = Date.now();
  var fast = (now - _lastPlaceTime) < 3000 && _lastPlaceTime > 0;
  _lastPlaceTime = now;
  if (placed === 2) {
    msgs = t('encourage_start');
  } else if (placed >= 4 && placed <= 5) {
    msgs = t('encourage_mid');
  } else if (placed === 7) {
    msgs = t('encourage_almost');
  } else if (fast && placed >= 3) {
    msgs = t('encourage_fast');
  } else {
    return;
  }
  if (!msgs || !msgs.length) return;
  _encourageShown = true;
  var msg = Array.isArray(msgs) ? msgs[Math.floor(Math.random() * msgs.length)] : msgs;
  var el = document.getElementById('encourage-toast');
  el.textContent = msg;
  el.classList.add('show');
  playSound('toast');
  setTimeout(function() { el.classList.remove('show'); }, 2500);
}

// --- 3-Step Win Flow ---
var _winStep = 0;
var _winData = {};
function _showWinRewardModal() {
  if (!_winData) return;
  // Hide all win steps and overlay so reward modal (z-index 300) isn't blocked by win-overlay (z-index 2000)
  _showWinStep(0);
  document.getElementById('win-overlay').classList.remove('show');
  var d = _winData;
  var _sDescKey = !_feature('win_meta') ? 'grade_s_desc_steam' : 'grade_s_desc';
  var gradeText = d.grade === 'S' ? t(_sDescKey) : d.grade === 'A' ? t('grade_a_desc') : t('grade_b_desc');
  var title = _isDailyChallenge ? t('daily_challenge_complete') : (d.isLevelComplete ? t('level_complete_title') : t('win_title'));
  var reason = d.grade + ' ' + gradeText;

  // No win_meta: skip reward modal entirely — go straight to step 3
  if (!_feature('win_meta')) {
    document.getElementById('win-overlay').classList.add('show');
    _showWinStep(3);
    playSound('select');
    return;
  }

  var rewards = [];
  if (_feature('win_meta')) {
    rewards.push({ icon: '\u2B50', value: d.expEarned, label: 'EXP' });
    var diamonds = 1 + (d.chapterBonus || 0);
    var _mult = typeof getActiveMultiplier === 'function' ? getActiveMultiplier() : 1;
    var _dcBonus = _isDailyChallenge ? 5 : 0;
    rewards.push({ icon: '\uD83D\uDC8E', value: diamonds * _mult + _dcBonus, label: _dcBonus > 0 ? '(+5 bonus)' : (_mult > 1 ? '(' + _mult + 'x)' : '') });
    if (d.newlyUnlocked && d.newlyUnlocked.length > 0) {
      rewards.push({ icon: '\uD83C\uDFC6', value: d.newlyUnlocked[0].diamonds || 0, label: t('ach_' + d.newlyUnlocked[0].id) });
    }
    if (_isDailyChallenge) reason += ' \u00B7 ' + t('daily_challenge_bonus');
    else if (d.isNewBest && d.prevBest > 0) reason += ' \u00B7 ' + t('win_new_best');
  } else {
    if (d.isNewBest && d.prevBest > 0) reason += ' \u00B7 ' + t('win_new_best');
  }

  // Daily challenge: only show return to menu (no leaderboard in pure mode)
  if (_isDailyChallenge) {
    showRewardModal({
      title: title,
      reason: reason,
      rewards: rewards,
      primary: { text: t('win_menu'), action: function() {
        returnToWelcome();
      }}
    });
  } else {
    showRewardModal({
      title: title,
      reason: reason,
      rewards: rewards,
      primary: { text: t('win_next'), action: function() {
        document.getElementById('win-overlay').classList.add('show');
        _showWinStep(3);
        playSound('select');
      }},
      secondary: { text: t('win_view_board'), action: function() {
        document.getElementById('win-overlay').classList.remove('show');
        clearConfetti();
        document.getElementById('win-back-btn').style.display = 'block';
      }}
    });
  }
}

function _showWinStep(step) {
  _winStep = step;
  document.getElementById('win-step1').style.display = step === 1 ? '' : 'none';
  document.getElementById('win-step2').style.display = step === 2 ? '' : 'none';
  document.getElementById('win-step3').style.display = step === 3 ? '' : 'none';
  if (step === 2 || step === 1) {
    var card = document.getElementById('win-step' + step);
    if (card.animate) {
      card.style.animation = 'none';
      card.animate([
        { transform: 'scale(0.2) translateY(60px) rotate(-5deg)', opacity: 0 },
        { transform: 'scale(1.15) translateY(-15px) rotate(2deg)', opacity: 1, offset: 0.4 },
        { transform: 'scale(0.92) translateY(6px) rotate(-1deg)', offset: 0.6 },
        { transform: 'scale(1.05) translateY(-3px) rotate(0.5deg)', offset: 0.8 },
        { transform: 'scale(1) translateY(0) rotate(0)' }
      ], { duration: 800, easing: 'ease-out', fill: 'forwards' });
    } else {
      card.style.animation = 'none';
      card.offsetHeight;
      card.style.animation = '';
    }
  }
}

// --- Daily Challenge (Steam-exclusive) ---
async function startDailyChallenge(level) {
  var date = getDailyChallengeDate();

  // Guard: FullPack must be ready for DC
  if (!_fullPackReader || !_fullPackReader.hasOrdering) {
    showSimpleToast('', t('dc_pack_not_ready'));
    return;
  }

  if (_dcHasTryOrDone(date, level)) {
    var done = _dcGetDone(date, level);
    showSimpleToast('', done ? t('daily_challenge_already_done') : t('daily_challenge_already_tried'));
    return;
  }
  // Fetch DC puzzle from backend API (forceAPI=true ensures backend's authoritative puzzle_number)
  try {
    const slot = getDailyChallengeSlot(date, level);
    const data = await fetchLevelPuzzle(level, slot, true);

    // Write try key immediately (locks the attempt)
    var tryData = { date: date, slot: slot, puzzle: data.puzzle_number, startedAt: new Date().toISOString(), v: 2 };
    localStorage.setItem(_dcTryKey(date, level), JSON.stringify(tryData));

    // Set daily challenge flags
    _isDailyChallenge = true;
    _dailyChallengeLevel = level;
    _dailyDate = date;
    currentLevel = null; // not a level-mode game
    currentSlot = 0;
    currentPuzzleNumber = data.puzzle_number;
    if (data.cells) _puzzleCache[data.puzzle_number] = data.cells;

    // Re-render card (row now shows "Locked")
    renderDailyChallengeCard();
    // Start game (bypasses energy check via _isDailyChallenge flag)
    startGame(data.puzzle_number);
  } catch (e) {
    console.warn('[Octile] Daily challenge generation failed:', e.message);
    showSimpleToast('', t('daily_challenge_error'));
    return;
  }
}

var _dcLbPlayerElo = null; // cached player ELO for tab gating

async function _fetchPlayerEloForDcLb() {
  if (_dcLbPlayerElo !== null) return _dcLbPlayerElo;
  try {
    var uuid = getBrowserUUID();
    var res = await fetch(WORKER_URL + '/player/' + uuid + '/elo', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return 0;
    var data = await res.json();
    _dcLbPlayerElo = data.elo || 0;
    return _dcLbPlayerElo;
  } catch (e) { return 0; }
}

async function showDailyChallengeLeaderboard(level, tab) {
  var date = getDailyChallengeDate();
  var modal = document.getElementById('dc-leaderboard-modal');
  if (!modal) return;
  document.getElementById('dc-lb-title').textContent = t('daily_challenge_leaderboard') + ' \u2014 ' + t('level_' + level);
  var body = document.getElementById('dc-lb-body');
  body.innerHTML = sbLoading();
  modal.classList.add('show');

  // Determine if Rating tab is available (ELO >= 2000, feature flag on)
  var playerElo = await _fetchPlayerEloForDcLb();
  var showRatingTab = _feature('rating_leaderboard') && playerElo >= 2000;
  var activeTab = (tab === 'rating' && showRatingTab) ? 'rating' : 'speed';

  // Render tab bar (only if player qualifies for rating tab)
  var tabBarEl = modal.querySelector('.dc-lb-tabs');
  if (tabBarEl) tabBarEl.remove();
  if (showRatingTab) {
    tabBarEl = document.createElement('div');
    tabBarEl.className = 'dc-lb-tabs';
    tabBarEl.innerHTML =
      '<button class="' + (activeTab === 'speed' ? 'active' : '') + '" data-tab="speed">' + t('daily_challenge_tab_speed') + '</button>' +
      '<button class="' + (activeTab === 'rating' ? 'active' : '') + '" data-tab="rating">' + t('daily_challenge_tab_rating') +
      ' <span class="dc-rating-help" title="' + escapeHtml(t('daily_challenge_rating_tooltip')) + '">?</span></button>';
    body.parentNode.insertBefore(tabBarEl, body);
    tabBarEl.querySelectorAll('button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        showDailyChallengeLeaderboard(level, btn.getAttribute('data-tab'));
      });
    });
  }

  if (activeTab === 'rating') {
    _renderDcRatingBoard(level, date, body);
  } else {
    _renderDcSpeedBoard(level, date, body);
  }
}

async function _renderDcSpeedBoard(level, date, body) {
  try {
    var res = await fetch(WORKER_URL + '/daily-challenge/scoreboard?level=' + level + '&date=' + date + '&limit=50', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    var scores = data.scores || [];
    if (!scores.length) {
      var hasLocalRecord = !!localStorage.getItem(_dcDoneKey(date, level));
      var emptyMsg = hasLocalRecord ? t('dc_lb_updating') : t('sb_no_scores');
      body.innerHTML = sbEmpty(emptyMsg);
      return;
    }
    var myUUID = getBrowserUUID();
    var html = '<div class="sb-table">';
    for (var i = 0; i < scores.length; i++) {
      var s = scores[i];
      var isMe = s.browser_uuid === myUUID;
      html += '<div class="sb-row' + (isMe ? ' sb-me' : '') + '">';
      html += '<span class="sb-rank">' + (i + 1) + '</span>';
      html += sbAvatarHTML(s.browser_uuid, 28, sbPicture(s.browser_uuid, s.picture));
      html += '<span class="sb-name">' + escapeHtml(sbDisplayName(s.browser_uuid, s.display_name)) + '</span>';
      html += '<span class="sb-time">' + sbFormatTime(s.resolve_time) + '</span>';
      html += '</div>';
    }
    html += '</div>';
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = sbError('showDailyChallengeLeaderboard(\'' + level + '\')');
    _bindRetryButtons(body);
  }
}

async function _renderDcRatingBoard(level, date, body) {
  try {
    var res = await fetch(WORKER_URL + '/daily-challenge/scoreboard?level=' + level + '&date=' + date + '&limit=50&sort=elo', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    var scores = data.scores || [];
    if (!scores.length) {
      var hasLocalRecord = !!localStorage.getItem(_dcDoneKey(date, level));
      var emptyMsg = hasLocalRecord ? t('dc_lb_updating') : t('sb_no_scores');
      body.innerHTML = sbEmpty(emptyMsg);
      return;
    }
    var myUUID = getBrowserUUID();
    var html = '<div class="dc-rating-desc">' + escapeHtml(t('daily_challenge_rating_desc')) + '</div>';
    html += '<div class="sb-table">';
    for (var i = 0; i < scores.length; i++) {
      var s = scores[i];
      var isMe = s.browser_uuid === myUUID;
      var delta = s.elo_delta || 0;
      var deltaClass = delta > 0 ? 'positive' : (delta < 0 ? 'negative' : 'zero');
      var deltaStr = delta > 0 ? '+' + Math.round(delta) : (delta < 0 ? '' + Math.round(delta) : '0');
      html += '<div class="sb-row' + (isMe ? ' sb-me' : '') + '">';
      html += '<span class="sb-rank">' + (i + 1) + '</span>';
      html += sbAvatarHTML(s.browser_uuid, 28, sbPicture(s.browser_uuid, s.picture));
      html += '<span class="sb-name">' + escapeHtml(sbDisplayName(s.browser_uuid, s.display_name)) + '</span>';
      html += '<span class="dc-elo-col">';
      html += '<span class="dc-elo-val">' + Math.round(s.elo || 0) + '</span>';
      html += '<span class="dc-elo-delta ' + deltaClass + '">(' + deltaStr + ')</span>';
      html += '</span>';
      html += '<span class="dc-grade">' + (s.grade || '') + '</span>';
      html += '<span class="sb-time">' + sbFormatTime(s.resolve_time) + '</span>';
      html += '</div>';
    }
    html += '</div>';
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = sbError('showDailyChallengeLeaderboard(\'' + level + '\',\'rating\')');
    _bindRetryButtons(body);
  }
}

function checkWin() {
  const allPlaced = pieces.every(p => p.placed);
  if (!allPlaced) return;
  gameOver = true;
  clearInterval(timerInterval);
  dismissAllHints();

  // Mark onboarding complete after first ever win
  if (!localStorage.getItem('octile_onboarded')) {
    localStorage.setItem('octile_onboarded', '1');
  }

  // Track unique solved puzzles
  const solved = getSolvedSet();
  const isFirstClear = !solved.has(currentPuzzleNumber);
  solved.add(currentPuzzleNumber);
  saveSolvedSet(solved);
  const totalUnique = solved.size;

  // Total solve count (including re-solves)
  const totalSolved = parseInt(localStorage.getItem('octile_total_solved') || '0') + 1;
  localStorage.setItem('octile_total_solved', totalSolved);

  // Cumulative time + grade tracking for profile
  localStorage.setItem('octile_total_time', parseFloat(localStorage.getItem('octile_total_time') || '0') + elapsed);
  var _gKey = 'octile_grades';
  var _grades; try { _grades = JSON.parse(localStorage.getItem(_gKey) || '{}'); } catch(e) { _grades = {}; }
  if (!_grades.S && !_grades.A && !_grades.B) _grades = { S: 0, A: 0, B: 0 };
  var _g = calcSkillGrade(currentLevel || 'easy', elapsed);
  _grades[_g] = (_grades[_g] || 0) + 1;
  localStorage.setItem(_gKey, JSON.stringify(_grades));

  const bestKey = 'octile_best_' + currentPuzzleNumber;
  const prevBest = parseInt(localStorage.getItem(bestKey) || '0');
  const isNewBest = prevBest === 0 || elapsed < prevBest;
  const improvement = prevBest > 0 ? prevBest - elapsed : 0;
  if (isNewBest) localStorage.setItem(bestKey, elapsed);

  // Deduct energy (daily challenge is free; skip entirely on Electron)
  var cost = 0, totalLeft = 99;
  if (_feature('energy')) {
    cost = _isDailyChallenge ? 0 : energyCost(elapsed);
    if (!_isDailyChallenge) deductEnergy(cost);
    if (!_isDailyChallenge) updateDailyStats(cost);
    var remainingPlays = Math.floor(getEnergyState().points);
    var dailyStatsNow = getDailyStats();
    var freePlayLeft = dailyStatsNow.puzzles === 0 ? 1 : 0;
    totalLeft = remainingPlays + freePlayLeft;
  }
  var winEnergyEl = document.getElementById('win-energy-cost');
  if (!_feature('energy')) {
    winEnergyEl.style.display = 'none';
  } else if (cost === 0) {
    winEnergyEl.textContent = t('energy_continue');
  } else if (totalLeft === 1) {
    winEnergyEl.textContent = t('energy_last_one');
  } else if (totalLeft <= 0) {
    winEnergyEl.innerHTML = t('energy_brand_quote');
  } else {
    winEnergyEl.textContent = t('win_energy_plays').replace('{left}', totalLeft);
  }

  // Award EXP + Diamonds
  const lvl = _isDailyChallenge ? _dailyChallengeLevel : (currentLevel || 'easy');
  const grade = calcSkillGrade(lvl, elapsed);
  const expEarned = _isDailyChallenge ? calcPuzzleExp(lvl, elapsed) * 2 : calcPuzzleExp(lvl, elapsed);
  addExp(expEarned);
  var _mult = getActiveMultiplier();
  var _dcDiamondBonus = _isDailyChallenge ? 5 : 0;
  addDiamonds(applyDiamondMultiplier(1) + _dcDiamondBonus);

  // Check chapter completion bonus
  let chapterBonus = 0;
  if (currentLevel) {
    const chSize = getChapterSize(currentLevel);
    // After advancing progress, check if we just completed a chapter boundary
    const newProgress = currentSlot; // will be set as new progress
    if (newProgress > 0 && newProgress % chSize === 0) {
      chapterBonus = chSize;
      addDiamonds(applyDiamondMultiplier(chapterBonus));
      incrementChaptersCompleted();
      _maybeShowSignInHint(); // first chapter completed
    }
    // Also check if this is the last puzzle in the level (partial chapter completion)
    const levelTotal = getEffectiveLevelTotal(currentLevel);
    if (newProgress === levelTotal && newProgress % chSize !== 0) {
      chapterBonus = newProgress % chSize;
      addDiamonds(applyDiamondMultiplier(chapterBonus));
      incrementChaptersCompleted();
    }
  }

  // --- Daily Tasks & Multiplier hooks ---
  if (_feature('daily_tasks')) {
    updateDailyTaskCounters(grade, elapsed, currentLevel || 'easy');
    updateDailyTaskProgress();
    checkConsecutiveAGrades(grade);
  }

  // Track monthly solves
  const monthIdx = new Date().getMonth();
  var monthsData; try { monthsData = JSON.parse(localStorage.getItem('octile_months') || '[]'); } catch(e) { monthsData = []; }
  if (!monthsData[monthIdx]) { monthsData[monthIdx] = true; localStorage.setItem('octile_months', JSON.stringify(monthsData)); }

  // Track night/morning solves
  const now = new Date();
  const hour = now.getHours(), mins = now.getMinutes(), timeVal = hour * 60 + mins;
  if (timeVal >= 22 * 60 || timeVal < 4 * 60 + 30) {
    localStorage.setItem('octile_night_solves', parseInt(localStorage.getItem('octile_night_solves') || '0') + 1);
  }
  if (timeVal >= 4 * 60 + 30 && timeVal < 9 * 60) {
    localStorage.setItem('octile_morning_solves', parseInt(localStorage.getItem('octile_morning_solves') || '0') + 1);
  }

  // Check achievements
  const streakCount = updateStreak();
  var newlyUnlocked = [];
  if (_feature('win_meta')) {
    const dailyStats = getDailyStats();
    const achStats = {
      unique: totalUnique, total: totalSolved, elapsed: elapsed, streak: streakCount,
      noHint: _hintsThisPuzzle === 0 && isFirstClear, dailyCount: dailyStats.puzzles, justSolved: true,
      nightSolves: parseInt(localStorage.getItem('octile_night_solves') || '0'),
      morningSolves: parseInt(localStorage.getItem('octile_morning_solves') || '0'),
      months: JSON.parse(localStorage.getItem('octile_months') || '[]'),
      levelEasy: getLevelProgress('easy'), levelMedium: getLevelProgress('medium'),
      levelHard: getLevelProgress('hard'), levelHell: getLevelProgress('hell'),
      chaptersCompleted: getChaptersCompleted(),
      totalEasy: getEffectiveLevelTotal('easy'), totalMedium: getEffectiveLevelTotal('medium'),
      totalHard: getEffectiveLevelTotal('hard'), totalHell: getEffectiveLevelTotal('hell'),
    };
    newlyUnlocked = checkAchievements(achStats);
  }
  advanceLevelProgress();

  // Onboarding tutorial hooks
  onTutorialWin(totalSolved, grade);

  const levelTotal = currentLevel ? getEffectiveLevelTotal(currentLevel) : 0;
  const isLevelComplete = currentLevel && levelTotal > 0 && currentSlot >= levelTotal;

  // Store win data for 3-step flow
  _winData = {
    elapsed, isNewBest, prevBest, grade, expEarned, chapterBonus,
    totalUnique, totalSolved, isFirstClear, improvement,
    newlyUnlocked, isLevelComplete, levelTotal,
    cost, totalLeft, motivation: getWinMotivation(totalUnique, isFirstClear, isNewBest, prevBest, elapsed, improvement),
    fact: (function() { var f = getWinFacts(); if (!_feature('hints') && Array.isArray(f)) f = f.filter(function(s) { return s.toLowerCase().indexOf('hint') < 0; }); return f.length > 0 ? f[Math.floor(Math.random() * f.length)] : ''; })(),
  };

  // --- Step 1: Celebration ---
  var gradeColors = { S: '#f1c40f', A: '#2ecc71', B: '#3498db' };
  if (currentLevel) {
    document.getElementById('win-puzzle-num').textContent = (LEVEL_DOTS[currentLevel] || '') + ' ' + t('level_' + currentLevel) + ' #' + currentSlot;
  } else {
    document.getElementById('win-puzzle-num').textContent = t('win_puzzle') + currentPuzzleNumber;
  }
  document.getElementById('win-time').textContent = formatTime(elapsed);
  var bestEl = document.getElementById('win-best');
  if (isNewBest && prevBest > 0) {
    bestEl.textContent = t('win_new_best') + ' (' + t('win_best') + formatTime(prevBest) + ')';
    bestEl.className = 'win-best-new';
    bestEl.style.display = '';
  } else if (isNewBest) {
    bestEl.textContent = t('win_new_best');
    bestEl.className = 'win-best-new';
    bestEl.style.display = '';
  } else if (prevBest) {
    bestEl.textContent = t('win_best') + formatTime(prevBest);
    bestEl.className = '';
    bestEl.style.display = '';
  } else {
    bestEl.style.display = 'none';
  }
  var gradeDescKey = grade === 'S' ? (!_feature('win_meta') ? 'grade_s_desc_steam' : 'grade_s_desc') : grade === 'A' ? 'grade_a_desc' : 'grade_b_desc';
  document.getElementById('win-grade').innerHTML = '<span class="win-grade-letter grade-' + grade.toLowerCase() + '">' + grade + '</span><span class="win-grade-desc">' + t(gradeDescKey) + '</span>';
  document.getElementById('win-grade').style.color = gradeColors[grade] || '#3498db';
  if (grade === 'S') {
    setTimeout(function() {
      var gl = document.querySelector('.win-grade-letter');
      if (gl) { var r = gl.getBoundingClientRect(); fxGoldBurst(r.left + r.width / 2, r.top + r.height / 2); }
    }, 300);
  }

  var lcEl = document.getElementById('win-level-complete');
  if (isLevelComplete) {
    var lcMsg = t('level_complete_msg').replace('{level}', t('level_' + currentLevel)).replace('{total}', levelTotal);
    lcEl.innerHTML = '<div class="level-complete-banner">' + (LEVEL_DOTS[currentLevel] || '') + ' ' + lcMsg + '</div>';
    lcEl.style.display = '';
    document.getElementById('win-step1-title').textContent = t('level_complete_title');
  } else {
    lcEl.style.display = 'none';
    document.getElementById('win-step1-title').textContent = t('win_title');
  }
  document.getElementById('win-tap1').textContent = t('win_tap_continue');

  // --- Step 2: Rewards (populated but hidden; empty on noMeta) ---
  var rewardsHtml = '';
  if (!_feature('win_meta')) {
    // No win_meta: skip step 2 entirely (no EXP/diamond/achievement display)
    document.getElementById('win-step2-title').textContent = '';
  } else {
    document.getElementById('win-step2-title').textContent = t('win_rewards_title');
    var expReason = t('reward_exp_grade').replace('{grade}', grade).replace('{level}', t('level_' + (currentLevel || 'easy')));
    rewardsHtml += '<div class="win-reward-line" style="animation-delay:0s">\u2B50 +' + expEarned + ' EXP <span class="win-reward-reason">' + expReason + '</span></div>';
    var diamondReason = chapterBonus > 0 ? t('reward_diamond_chapter') : t('reward_diamond_base');
    rewardsHtml += '<div class="win-reward-line" style="animation-delay:0.2s">\uD83D\uDC8E +' + (1 + chapterBonus) + ' ' + t('win_diamonds_label') + ' <span class="win-reward-reason">' + diamondReason + '</span></div>';
    if (newlyUnlocked.length > 0) {
      for (var ni = 0; ni < newlyUnlocked.length; ni++) {
        var ach = newlyUnlocked[ni];
        rewardsHtml += '<div class="win-reward-line" style="animation-delay:' + (0.4 + ni * 0.2) + 's">\uD83C\uDFC6 ' + t('ach_' + ach.id) + '</div>';
      }
    }
  }
  document.getElementById('win-rewards').innerHTML = rewardsHtml;
  document.getElementById('win-achievement').innerHTML = '';
  document.getElementById('win-tap2').textContent = t('win_tap_continue');

  // --- Step 3: What's Next (populated but hidden) ---
  if (isLevelComplete) {
    document.getElementById('win-step3-title').textContent = t('level_complete_title');
    document.getElementById('win-next-btn').innerHTML = t('level_complete_back');
  } else {
    var progressText = currentLevel
      ? (!_feature('win_meta')
        ? (LEVEL_DOTS[currentLevel] || '') + ' ' + t('win_puzzle_position').replace('{n}', currentSlot).replace('{total}', levelTotal)
        : (LEVEL_DOTS[currentLevel] || '') + ' ' + currentSlot + ' / ' + levelTotal)
      : t('motiv_unique_count').replace('{n}', totalUnique).replace('{total}', getEffectivePuzzleCount());
    document.getElementById('win-step3-title').textContent = progressText;
    document.getElementById('win-next-btn').innerHTML = t('win_next');
  }
  if (!_feature('energy')) {
    document.getElementById('win-energy-cost').style.display = 'none';
  } else {
    document.getElementById('win-energy-cost').style.display = '';
    document.getElementById('win-energy-cost').textContent = '\u26A1 ' + t('win_energy_plays').replace('{left}', totalLeft);
  }
  var motivEl = document.getElementById('win-motivation');
  motivEl.textContent = _winData.motivation;
  motivEl.style.display = _winData.motivation ? '' : 'none';
  document.getElementById('win-fact').textContent = _winData.fact;
  document.getElementById('win-prev-btn').style.display = (currentLevel && currentSlot > 1) ? '' : 'none';
  document.getElementById('win-share-btn').innerHTML = t('win_share');
  document.getElementById('win-view-btn').textContent = t('win_view_board');
  document.getElementById('win-random-btn').style.display = 'none';
  document.getElementById('win-menu-btn').textContent = t('win_menu');
  document.getElementById('win-back-btn').textContent = t('win_back');

  // Show step 1
  _showWinStep(1);
  triggerBoardPulse();
  var overlay = document.getElementById('win-overlay');
  overlay.classList.add('show');
  playSound('win'); haptic([50, 30, 50, 30, 100]);
  spawnConfetti();

  // Daily challenge: write done key, update streak, show special reward modal
  if (_isDailyChallenge) {
    localStorage.setItem(_dcDoneKey(_dailyDate, _dailyChallengeLevel), JSON.stringify({
      time: elapsed, grade: grade, puzzle: currentPuzzleNumber, v: 2
    }));
    updateDailyChallengeStreak(_dailyDate);
    // First-time daily completion: hint about leaderboard
    if (!localStorage.getItem('octile_dc_hint_seen')) {
      localStorage.setItem('octile_dc_hint_seen', '1');
      setTimeout(function() { showSimpleToast('', t('daily_challenge_lb_hint'), 5000); }, 1500);
    }
    renderDailyChallengeCard();
    // Disable next/restart in post-win UI (one-shot DC)
    document.getElementById('win-next-btn').style.display = 'none';
    document.getElementById('win-prev-btn').style.display = 'none';
    document.getElementById('win-random-btn').style.display = 'none';
    document.getElementById('win-next-kbd').style.display = 'none';
  } else {
    // Normal puzzles: ensure Next button and kbd hint are visible
    document.getElementById('win-next-btn').style.display = '';
    document.getElementById('win-next-kbd').style.display = '';
  }

  if (!_isDemoMode && _feature('score_submission')) submitScore(currentPuzzleNumber, elapsed);
  if (!_isDemoMode && _feature('score_submission') && isAuthenticated()) syncProgress();
  for (const key in sbCache) delete sbCache[key];
}

function clearConfetti() {
  document.querySelectorAll('.confetti-piece').forEach(el => el.remove());
}

function spawnConfetti() {
  clearConfetti();
  if (!_fxCtx) return;
  var colors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#ecf0f1', '#9b59b6', '#e67e22', '#ff69b4'];
  var w = window.innerWidth;
  var pts = [0.1, 0.3, 0.5, 0.7, 0.9];
  for (var s = 0; s < pts.length; s++) {
    (function(idx) {
      setTimeout(function() {
        _fxEmit({
          x: w * pts[idx], y: -20,
          count: 25, colors: colors,
          speed: 80, life: 5, size: 10, gravity: 60,
          angle: Math.PI / 2, spread: Math.PI * 0.8,
          type: idx % 3 === 0 ? 'sparkle' : idx % 2 === 0 ? 'rect' : 'circle'
        });
      }, idx * 150);
    })(s);
  }
}

async function _showDemoCTA() {
  showRewardModal({
    title: t('demo_cta_title'),
    reason: t('demo_cta_body'),
    hideRewards: true,
    primary: { text: t('demo_cta_buy'), action: function() {
      var url = 'https://store.steampowered.com/app/0/Octile/'; // TODO: replace with real Steam App ID
      if (window.steam && window.steam.openURL) window.steam.openURL(url);
      else window.open(url, '_blank');
    }},
    secondary: { text: t('demo_cta_keep'), action: function() { returnToWelcome(); } }
  });
}

async function nextPuzzle() {
  if (_feature('energy') && !hasEnoughEnergy()) {
    document.getElementById('win-overlay').classList.remove('show');
    clearConfetti();
    showEnergyModal(true);
    return;
  }
  // Demo mode: show CTA after 10 total solves or when hitting difficulty cap
  if (_isDemoMode) {
    var _demoSolves = parseInt(localStorage.getItem('octile_total_solved') || '0');
    if (_demoSolves >= 10) {
      document.getElementById('win-overlay').classList.remove('show');
      _showDemoCTA();
      return;
    }
  }
  document.getElementById('win-overlay').classList.remove('show');
  if (currentLevel) {
    const total = getEffectiveLevelTotal(currentLevel);
    if (total > 0 && currentSlot >= total) {
      // Level/demo cap reached — show respectful CTA in demo, otherwise return to welcome
      if (_isDemoMode) {
        showRewardModal({
          title: t('demo_cta_title'),
          reason: t('demo_cap_reached').replace('{level}', t('level_' + currentLevel)),
          hideRewards: true,
          primary: { text: t('demo_cta_buy'), action: function() {
            var url = 'https://store.steampowered.com/app/0/Octile/';
            if (window.steam && window.steam.openURL) window.steam.openURL(url);
            else window.open(url, '_blank');
          }},
          secondary: { text: t('demo_cta_keep'), action: function() { returnToWelcome(); } }
        });
        return;
      }
      returnToWelcome();
      return;
    }
    // Unified navigation: use goLevelSlot as single gate
    await goLevelSlot(currentSlot + 1);
  } else {
    console.warn('[Octile] nextPuzzle called without currentLevel');
  }
}

function showLevelComplete(level, total) {
  currentLevel = null;
  gameStarted = false;
  const boardEl = document.getElementById('board');
  boardEl.style.display = 'none';
  document.getElementById('pool-section').style.display = 'none';
  document.getElementById('action-bar').style.display = 'none';
  document.getElementById('pause-btn').style.display = 'none';
  clearInterval(timerInterval);

  const welcome = document.getElementById('welcome-panel');
  welcome.classList.remove('hidden');
  welcome.innerHTML = '<div class="level-complete">'
    + '<div class="level-complete-icon">' + (LEVEL_DOTS[level] || '') + '</div>'
    + '<h2>' + t('level_complete_title') + '</h2>'
    + '<p>' + t('level_complete_msg').replace('{level}', t('level_' + level)).replace('{total}', total) + '</p>'
    + '<button class="btn-random" id="level-complete-btn">' + t('level_complete_back') + '</button>'
    + '</div>';
  document.getElementById('level-complete-btn').addEventListener('click', () => {
    welcome.innerHTML = '';
    // Rebuild welcome panel (re-insert level cards)
    location.reload();
  });
}

function winRandom() {
  document.getElementById('win-overlay').classList.remove('show');
  currentLevel = null;
  startGame(getRandomPuzzleNumber());
}

function shareGame() {
  if (gameStarted) {
    const num = currentPuzzleNumber;
    const puzzleUrl = SITE_URL + '?p=' + num;
    const text = t('share_text');
    if (navigator.share) {
      navigator.share({ text: text, url: puzzleUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text + ' ' + puzzleUrl).then(() => {
        showCopiedToast();
      }).catch(() => {});
    }
  } else {
    doShare(t('share_text'));
  }
}

function shareWin() {
  const num = currentPuzzleNumber;
  const time = formatTime(elapsed);
  const puzzleLabel = currentLevel
    ? t('level_' + currentLevel) + ' #' + currentSlot
    : '#' + num;
  const text = t('share_win_prefix') + puzzleLabel + t('share_win_mid') + time + t('share_win_suffix');
  const puzzleUrl = SITE_URL + '?p=' + num;
  captureBoardScreenshot(num).then(file => {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ text: text, url: puzzleUrl, files: [file] }).catch(() => {});
    } else if (navigator.share) {
      navigator.share({ text: text, url: puzzleUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text + '\n' + puzzleUrl).then(() => {
        showCopiedToast();
      }).catch(() => {});
    }
  });
}

function captureBoardScreenshot(puzzleNum) {
  return new Promise(resolve => {
    try {
      const SIZE = 480;
      const CELLS = 8;
      const PAD = 40;
      const CELL_SIZE = (SIZE - PAD * 2) / CELLS;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE + 48;
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Color map
      const colors = { grey: '#888', red: '#e74c3c', white: '#ecf0f1', blue: '#3498db', yellow: '#f1c40f' };
      const emptyColor = '#16213e';

      // Draw cells
      for (let r = 0; r < CELLS; r++) {
        for (let c = 0; c < CELLS; c++) {
          const x = PAD + c * CELL_SIZE;
          const y = PAD + r * CELL_SIZE;
          const pid = board[r][c];
          if (pid) {
            const p = getPieceById(pid);
            ctx.fillStyle = p ? (colors[p.color] || emptyColor) : emptyColor;
          } else {
            ctx.fillStyle = emptyColor;
          }
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

          // Piece borders
          if (pid) {
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 2;
            if (r === 0 || board[r-1][c] !== pid) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + CELL_SIZE, y); ctx.stroke(); }
            if (r === 7 || board[r+1]?.[c] !== pid) { ctx.beginPath(); ctx.moveTo(x, y + CELL_SIZE); ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE); ctx.stroke(); }
            if (c === 0 || board[r][c-1] !== pid) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + CELL_SIZE); ctx.stroke(); }
            if (c === 7 || board[r][c+1] !== pid) { ctx.beginPath(); ctx.moveTo(x + CELL_SIZE, y); ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE); ctx.stroke(); }
          }
        }
      }

      // Title and puzzle number
      ctx.fillStyle = '#eee';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Octile', PAD, 28);
      ctx.textAlign = 'right';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = '#aaa';
      const screenshotLabel = currentLevel
        ? t('level_' + currentLevel) + ' #' + currentSlot
        : '#' + puzzleNum;
      ctx.fillText(screenshotLabel, SIZE - PAD, 28);

      // Bottom text
      ctx.textAlign = 'center';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = '#888';
      const baseUrl = location.href.split('?')[0].split('#')[0];
      ctx.fillText(baseUrl + '?p=' + puzzleNum, SIZE / 2, SIZE + 36);

      canvas.toBlob(blob => {
        if (blob) {
          resolve(new File([blob], 'octile-' + puzzleNum + '.png', { type: 'image/png' }));
        } else {
          resolve(null);
        }
      }, 'image/png');
    } catch (e) {
      resolve(null);
    }
  });
}

function doShare(text) {
  if (navigator.share) {
    navigator.share({ text: text, url: SITE_URL }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text + ' ' + SITE_URL).then(() => {
      showCopiedToast();
    }).catch(() => {});
  }
}

let toastTimer = null;
function showCopiedToast() {
  let toast = document.getElementById('copy-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'copy-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = t('copied');
  toast.style.opacity = '1';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.opacity = '0'; toastTimer = null; }, 2000);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

async function resetGame(puzzleNumber) {
  _hintsThisPuzzle = 0;
  rolloverDailyHints();
  if (hintTimeout) { clearTimeout(hintTimeout); hintTimeout = null; }
  if (motivationTimeout) { clearTimeout(motivationTimeout); motivationTimeout = null; }
  tutorialTimeouts.forEach(t => clearTimeout(t));
  tutorialTimeouts = [];
  motivationShown = false;
  clearConfetti();
  clearInterval(timerInterval);
  timerInterval = null;
  timerStarted = false;
  elapsed = 0;
  elapsedBeforePause = 0;
  paused = false;
  document.getElementById('pause-overlay').classList.remove('show');
  document.getElementById('pause-btn').style.display = 'none';
  document.getElementById('timer').style.opacity = '';
  piecesPlacedCount = 0;
  _encourageShown = false;
  _lastPlaceTime = 0;
  document.querySelectorAll('.snap-done').forEach(function(c) { c.classList.remove('snap-done'); });
  document.getElementById('timer').textContent = '0:00';
  selectedPiece = null;
  document.body.classList.remove('piece-selected');
  gameOver = false;
  if (typeof _kbCursorR !== 'undefined') { _kbCursorR = -1; _kbCursorC = -1; }
  document.getElementById('win-overlay').classList.remove('show');
  document.getElementById('win-back-btn').style.display = 'none';
  pieces = PIECES.map(p => ({
    ...p,
    currentShape: p.shape.map(r => [...r]),
    placed: false,
    boardR: -1,
    boardC: -1,
  }));
  _moveLog = [];
  _placementOrder = [];
  if (puzzleNumber === undefined) puzzleNumber = currentPuzzleNumber;
  await loadPuzzle(puzzleNumber);
  renderBoard();
  renderPool();
  updateHintBtn();
  _updateControlButtons();
}

// --- Simple toast helper (reuses #achieve-toast) ---
function showSimpleToast(icon, text, duration) {
  var toast = document.getElementById('achieve-toast');
  if (!toast || toast.classList.contains('show')) return;
  toast.querySelector('.toast-icon').textContent = icon;
  toast.querySelector('.toast-label').textContent = '';
  toast.querySelector('.toast-name').textContent = text;
  toast.classList.add('show');
  if (achieveToastTimer) clearTimeout(achieveToastTimer);
  achieveToastTimer = setTimeout(function() { toast.classList.remove('show'); achieveToastTimer = null; }, duration || 3500);
}

// --- Splash (auto-dismiss) ---
let splashDismissed = false;

function dismissSplash() {
  if (splashDismissed) return;
  splashDismissed = true;
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('fade-out');
  setTimeout(() => {
    splash.remove();
    // First-time user: skip welcome panel, jump straight into Easy #1
    if (!localStorage.getItem('octile_onboarded')) {
      if (!_levelTotals.easy) _levelTotals = {..._getOfflineTotals()};
      startLevel('easy');
    }
  }, 600);
}

// Auto-dismiss: configurable via splashDismissMs in config.json
setTimeout(dismissSplash, localStorage.getItem('octile_onboarded') ? SPLASH_DISMISS_RETURNING : SPLASH_DISMISS_NEW);
document.addEventListener('pointerdown', dismissSplash, { once: true });
document.addEventListener('keydown', dismissSplash, { once: true });

// --- Welcome Panel / Game Flow ---
let gameStarted = false;

function showWelcomeState() {
  const statsEl = document.getElementById('wp-stats');
  if (!_feature('diamonds')) {
    // No diamonds: no stats header (no EXP, diamonds, streak, energy)
    if (_isDemoMode) {
      statsEl.innerHTML = '<span class="wp-demo-label">' + t('demo_label') + '</span>';
      statsEl.style.display = '';
    } else {
      statsEl.innerHTML = '';
      statsEl.style.display = 'none';
    }
  } else {
    statsEl.style.display = '';
    const streak = getStreak();
    var _statsHtml =
      '<span class="wp-stat"><span class="wp-stat-icon">\u2B50</span><span class="wp-stat-value">' + getExp().toLocaleString() + '</span></span>' +
      '<span class="wp-stat"><span class="wp-stat-icon">\uD83D\uDC8E</span><span class="wp-stat-value">' + getDiamonds().toLocaleString() + '</span></span>' +
      '<span class="wp-stat"><span class="wp-stat-icon">\uD83D\uDD25</span><span class="wp-stat-value">' + (streak.count || 0) + '</span> ' + t('wp_days') + '</span>' +
      '<span class="wp-stat"><span class="wp-stat-icon">\u26A1</span><span class="wp-stat-value">' + Math.floor(getEnergyState().points) + '</span></span>';
    statsEl.innerHTML = _statsHtml;
  }

  // Today Goal card (hidden on Electron via renderTodayGoalCard)
  renderTodayGoalCard();
  renderDailyChallengeCard();
  showTier1();
  if (_feature('energy')) updateEnergyDisplay();
}

function startGame(puzzleNumber) {
  if (_feature('energy') && !_isDailyChallenge && !hasEnoughEnergy()) { showEnergyModal(true); return; }
  const welcome = document.getElementById('welcome-panel');
  if (welcome && !welcome.classList.contains('hidden')) {
    welcome.classList.add('anim-out');
    setTimeout(() => {
      welcome.classList.add('hidden');
      welcome.classList.remove('anim-out');
      revealGame(puzzleNumber);
    }, 300);
  } else {
    revealGame(puzzleNumber);
  }
}

async function revealGame(puzzleNumber) {
  _stopHealthPoll();
  gameStarted = true;
  document.body.classList.add('in-game');
  currentPuzzleNumber = puzzleNumber;
  localStorage.setItem('octile_last_played', Date.now());

  const boardEl = document.getElementById('board');
  const poolEl = document.getElementById('pool-section');
  const actionBarEl = document.getElementById('action-bar');
  const menuBtn = document.getElementById('menu-btn');

  boardEl.style.display = '';
  poolEl.style.display = '';
  actionBarEl.style.display = '';
  menuBtn.style.display = '';

  // Staggered fade-in
  boardEl.classList.add('game-fade-in');
  poolEl.classList.add('game-fade-in');
  poolEl.style.animationDelay = '0.1s';
  actionBarEl.classList.add('game-fade-in');
  actionBarEl.style.animationDelay = '0.15s';

  setTimeout(() => {
    boardEl.classList.remove('game-fade-in');
    poolEl.classList.remove('game-fade-in');
    poolEl.style.animationDelay = '';
    actionBarEl.classList.remove('game-fade-in');
    actionBarEl.style.animationDelay = '';
  }, 500);

  await resetGame(puzzleNumber);
  updateLevelNav();
  // Hide restart and hint buttons for daily challenge (fairness: one attempt, no hints)
  // Electron D1: always hide hint button
  document.getElementById('ctrl-restart').style.display = _isDailyChallenge ? 'none' : '';
  document.getElementById('hint-btn').style.display = (_isDailyChallenge || !_feature('hints')) ? 'none' : '';
  setTimeout(showPoolScrollHint, 800);

  // Flow 3: "First puzzle of the day. Take your time." hint (skip on Electron — no energy)
  const _dailyStatsAtStart = getDailyStats();
  if (_feature('energy') && _dailyStatsAtStart.puzzles === 0) {
    tutorialTimeouts.push(setTimeout(() => {
      if (gameOver) return;
      showHintTooltip(t('win_energy_free'), document.getElementById('board-container'), 'daily-free');
      setTimeout(() => dismissHint('daily-free'), 5000);
    }, 600));
  }

  // Onboarding tutorial steps
  var _tutStep = _getTutStep();
  if (_tutStep === 0) {
    // Step 1: First puzzle — show fill board hint
    tutorialTimeouts.push(setTimeout(() => tutStep1_FillBoard(), 800));
  } else if (_tutStep === 4) {
    // Step 4: Goal-setting hint at start of puzzle #4
    tutorialTimeouts.push(setTimeout(() => tutStep4_GoalSetting(), 800));
  }
  if (_tutStep === 5) {
    // Step 5: Start stuck timer for hint system tutorial
    tutStep5_StartStuckTimer();
  }

  // Gentle pulse on pieces for first 2 games
  var _totalPlayed = parseInt(localStorage.getItem('octile_total_solved') || '0');
  if (_totalPlayed < 2) {
    tutorialTimeouts.push(setTimeout(function() {
      document.querySelectorAll('.piece-wrapper:not(.placed)').forEach(function(el) {
        el.classList.add('nudge');
      });
      setTimeout(function() {
        document.querySelectorAll('.piece-wrapper.nudge').forEach(function(el) {
          el.classList.remove('nudge');
        });
      }, 1500);
    }, 1200));
  }

  // Motivational quote after 120s if stuck
  if (motivationTimeout) clearTimeout(motivationTimeout);
  motivationTimeout = setTimeout(() => {
    if (gameOver || !gameStarted || motivationShown || piecesPlacedCount > 1) return;
    motivationShown = true;
    var quotes = getMotivationQuotes();
    if (!_feature('hints') && Array.isArray(quotes)) quotes = quotes.filter(function(q) { return q.toLowerCase().indexOf('hint') < 0; });
    const text = quotes[Math.floor(Math.random() * quotes.length)];
    showHintTooltip(text, document.getElementById('board-container'), 'motivation');
    // Auto-dismiss after 8s
    setTimeout(() => dismissHint('motivation'), 8000);
  }, 120000);
}

function returnToWelcome() {
  _isDailyChallenge = false;
  _dailyChallengeLevel = null;
  _dailyDate = null;
  clearInterval(timerInterval);
  timerInterval = null;
  timerStarted = false;
  paused = false;
  elapsedBeforePause = 0;
  gameOver = true;
  gameStarted = false;
  document.body.classList.remove('in-game', 'zen-mode', 'piece-selected');
  dismissAllHints();
  clearConfetti();
  tutorialTimeouts.forEach(t => clearTimeout(t));
  tutorialTimeouts = [];
  if (motivationTimeout) { clearTimeout(motivationTimeout); motivationTimeout = null; }
  tutStep5_CancelStuckTimer();

  document.getElementById('win-overlay').classList.remove('show');
  document.getElementById('win-back-btn').style.display = 'none';
  document.getElementById('board').style.display = 'none';
  document.getElementById('pool-section').style.display = 'none';
  document.getElementById('action-bar').style.display = 'none';
  document.getElementById('menu-btn').style.display = 'none';
  document.getElementById('pause-btn').style.display = 'none';
  document.getElementById('pause-overlay').classList.remove('show');
  document.getElementById('timer').style.opacity = '';
  document.getElementById('timer').textContent = '0:00';

  const welcome = document.getElementById('welcome-panel');
  welcome.classList.remove('hidden');
  showWelcomeState();
  _startHealthPoll();
  tutStep9_Closing();
}

// welcomeRandom/welcomeGo removed — replaced by level-based flow

// --- Tutorial & Hint System ---
// 9-step onboarding: each step shown once, tracked by localStorage
// Steps: 1=fill board, 2=rotate, 3=first rating, 4=goal-setting,
//        5=hint system, 6=daily progress, 7=locked feature, 8=sign-in, 9=closing
let activeHints = [];
let tutorialTimeouts = [];

function _getTutStep() {
  return parseInt(localStorage.getItem('octile_tut_step') || '0');
}
function _setTutStep(step) {
  localStorage.setItem('octile_tut_step', step);
}
function isTutorialDone() {
  return _getTutStep() >= 9;
}

function showHintTooltip(text, targetEl, id, duration) {
  if (!targetEl) return;
  dismissHint(id);
  const hint = document.createElement('div');
  hint.className = 'tutorial-hint';
  hint.dataset.hintId = id;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'hint-close';
  closeBtn.textContent = '\u00D7';
  closeBtn.addEventListener('click', () => dismissHint(id));
  const span = document.createElement('span');
  span.textContent = text;
  hint.appendChild(span);
  hint.appendChild(closeBtn);

  // Position relative to target
  const container = targetEl.closest('#main-area') || document.body;
  container.style.position = 'relative';
  container.appendChild(hint);

  const targetRect = targetEl.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  hint.style.left = (targetRect.left - containerRect.left + 10) + 'px';
  hint.style.top = (targetRect.top - containerRect.top - 8) + 'px';

  var dur = duration || 6000;
  activeHints.push({ id, element: hint, timer: setTimeout(() => dismissHint(id), dur) });
}

function dismissHint(id) {
  const idx = activeHints.findIndex(h => h.id === id);
  if (idx === -1) return;
  const h = activeHints[idx];
  clearTimeout(h.timer);
  if (h.element.parentNode) h.element.parentNode.removeChild(h.element);
  activeHints.splice(idx, 1);
}

function dismissAllHints() {
  [...activeHints].forEach(h => dismissHint(h.id));
}

// Step 1: First puzzle — "Fill the board" + "Tap a tile"
function tutStep1_FillBoard() {
  if (_getTutStep() >= 1 || gameOver || !gameStarted) return;
  var board = document.getElementById('board-container');
  showHintTooltip(t('tut_fill_board'), board, 'tut1', 8000);
  tutorialTimeouts.push(setTimeout(function() {
    if (gameOver) return;
    dismissHint('tut1');
    var pool = document.getElementById('pool-section');
    showHintTooltip(t('tut_tap_piece'), pool, 'tut1b', 8000);
  }, 4000));
}

// Step 1 complete: on first win
function tutStep1_Complete() {
  if (_getTutStep() >= 1) return;
  _setTutStep(1);
  dismissAllHints();
}

// Step 2: Rotation — shown on puzzle #2 when player taps a selected piece
function tutStep2_Rotate() {
  if (_getTutStep() !== 1 || gameOver || !gameStarted) return;
  var pool = document.getElementById('pool-section');
  showHintTooltip(t('tut_rotate'), pool, 'tut2', 8000);
  _setTutStep(2);
}

// Step 2 complete: on win of puzzle #2
function tutStep2_Complete() {
  if (_getTutStep() < 2 || _getTutStep() >= 3) return;
  // "Getting the hang of it" shown as encourage toast
  var el = document.getElementById('encourage-toast');
  if (el) {
    el.textContent = t('tut_getting_hang');
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 3000);
  }
  _setTutStep(3);
}

// Step 3: First rating — shown on win of puzzle #3
function tutStep3_Rating(grade) {
  if (_getTutStep() !== 3) return;
  _setTutStep(4);
  // Override win step 1 title with "Rating unlocked!"
  var titleEl = document.getElementById('win-step1-title');
  if (titleEl) titleEl.textContent = t('tut_rating_unlock');
  // Show rating description as toast after win card shows
  setTimeout(function() {
    var el = document.getElementById('encourage-toast');
    if (el) {
      el.textContent = t('tut_rating_desc');
      el.classList.add('show');
      setTimeout(function() { el.classList.remove('show'); }, 4000);
    }
    // If grade A or above
    if (grade === 'S' || grade === 'A') {
      setTimeout(function() {
        var el2 = document.getElementById('encourage-toast');
        if (el2) {
          el2.textContent = '\uD83D\uDC4D ' + t('tut_solid_solution');
          el2.classList.add('show');
          setTimeout(function() { el2.classList.remove('show'); }, 3000);
        }
      }, 4500);
    }
  }, 1500);
}

// Step 4: Goal-setting — shown at start of puzzle #4
function tutStep4_GoalSetting() {
  if (_getTutStep() !== 4 || gameOver || !gameStarted) return;
  var board = document.getElementById('board-container');
  showHintTooltip(t('tut_every_puzzle'), board, 'tut4', 8000);
  _setTutStep(5);
}

// Step 5: Hint system — shown after stuck for X seconds (no pieces placed for 30s)
var _tutStuckTimer = null;
function tutStep5_StartStuckTimer() {
  if (!_feature('hints')) return; // no hints, skip hint tutorial
  if (_getTutStep() !== 5 || isTutorialDone()) return;
  if (_tutStuckTimer) clearTimeout(_tutStuckTimer);
  _tutStuckTimer = setTimeout(function() {
    if (gameOver || !gameStarted || piecesPlacedCount > 0) return;
    var hintBtn = document.getElementById('hint-btn');
    showHintTooltip(t('tut_stuck'), hintBtn, 'tut5', 8000);
    _setTutStep(6);
  }, 30000);
}
function tutStep5_CancelStuckTimer() {
  if (_tutStuckTimer) { clearTimeout(_tutStuckTimer); _tutStuckTimer = null; }
}

// Step 6: Daily progress — shown after ≥5 total solves
function tutStep6_DailyProgress(totalSolved) {
  if (_getTutStep() < 6 || _getTutStep() >= 7) return;
  if (totalSolved < 5) return;
  _setTutStep(7);
  var dailyStats = getDailyStats();
  var msg = t('tut_daily_progress').replace('{done}', dailyStats.puzzles).replace('{total}', 3);
  var el = document.getElementById('encourage-toast');
  if (el) {
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 4000);
  }
  setTimeout(function() {
    var el2 = document.getElementById('encourage-toast');
    if (el2) {
      el2.textContent = t('tut_little_progress');
      el2.classList.add('show');
      setTimeout(function() { el2.classList.remove('show'); }, 4000);
    }
  }, 5000);
}

// Step 7: Locked feature teaser — shown when tapping locked features
function tutStep7_LockedFeature() {
  if (_getTutStep() < 7 || _getTutStep() >= 8) return;
  _setTutStep(8);
  var el = document.getElementById('encourage-toast');
  if (el) {
    el.textContent = t('tut_keep_playing');
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 3000);
  }
}

// Step 8: Sign-in prompt — shown after ≥5 solves (uses existing _maybeShowSignInHint but with better copy)
// This is handled by existing _maybeShowSignInHint, we just upgrade the text

// Step 9: Day 1 closing — shown when returning to welcome after ≥3 solves
function tutStep9_Closing() {
  if (_getTutStep() < 8 || _getTutStep() >= 9) return;
  var total = parseInt(localStorage.getItem('octile_total_solved') || '0');
  if (total < 3) return;
  _setTutStep(9);
  setTimeout(function() {
    var el = document.getElementById('encourage-toast');
    if (el) {
      el.textContent = t('tut_see_tomorrow');
      el.classList.add('show');
      setTimeout(function() { el.classList.remove('show'); }, 4000);
    }
  }, 800);
}

// Legacy compatibility
function isTutorialSeen() { return isTutorialDone(); }
function markTutorialSeen() { if (!isTutorialDone()) _setTutStep(9); }

// Called from piece placement — replaces old showTutorialHint2/maybeCompleteTutorial
function onPiecePlaced() {
  tutStep5_CancelStuckTimer(); // placed a piece, cancel stuck timer
  // On first piece in puzzle #2, show rotation hint
  if (piecesPlacedCount === 1 && _getTutStep() === 1) {
    // Will show rotate hint on next piece selection, not placement
  }
}

// Called from checkWin — orchestrates win-time tutorial steps
function onTutorialWin(totalSolved, grade) {
  var step = _getTutStep();
  if (step === 0) {
    tutStep1_Complete(); // first ever win
  } else if (step >= 1 && step < 3) {
    tutStep2_Complete(); // second win
  }
  if (step === 3) {
    tutStep3_Rating(grade); // third win: rating unlock
  }
  tutStep6_DailyProgress(totalSolved);
}

// --- i18n (loaded from translations.json) ---
let TRANSLATIONS = { en: {}, zh: {} };
(function loadTranslations() {
  // Try sync XHR first (works when SW cache is ready or online)
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'translations.json', false);
    xhr.send();
    if (xhr.status === 200 || xhr.status === 0) {
      TRANSLATIONS = JSON.parse(xhr.responseText);
      try { localStorage.setItem('octile_translations_cache', xhr.responseText); } catch(e) {}
      return;
    }
  } catch(e) {}
  // Fallback: load from localStorage cache (offline resilience)
  try {
    var cached = localStorage.getItem('octile_translations_cache');
    if (cached) TRANSLATIONS = JSON.parse(cached);
  } catch(e) {}
})();

function t(key) { return TRANSLATIONS[currentLang][key] || TRANSLATIONS.en[key] || key; }

function applyLanguage() {
  document.documentElement.lang = currentLang === 'zh' ? 'zh-Hant' : 'en';
  // Header
  document.getElementById('settings-help-label').textContent = t('menu_help_about');
  document.getElementById('settings-scoreboard-label').textContent = t('menu_community');
  document.getElementById('scoreboard-title').textContent = t('sb_title');
  document.getElementById('sb-tab-global').textContent = t('sb_tab_global');
  document.getElementById('sb-tab-me').textContent = t('sb_tab_me');
  document.getElementById('sb-tab-league').textContent = t('league_tab');

  // Settings modal
  document.getElementById('settings-title').textContent = t('menu_title');
  document.getElementById('settings-lang-label').textContent = t('menu_lang');
  var _langSelect = document.getElementById('settings-lang-select');
  _langSelect.value = _langPref;
  var _langKeys = { system: 'lang_system', en: 'lang_en', zh: 'lang_zh' };
  for (var _li = 0; _li < _langSelect.options.length; _li++) {
    var _lk = _langKeys[_langSelect.options[_li].value];
    if (_lk) _langSelect.options[_li].textContent = t(_lk);
  }
  document.getElementById('settings-theme-label').textContent = t('menu_theme');
  renderThemeGrid();

  // Quit confirm modal
  document.getElementById('quit-confirm-title').textContent = t('quit_confirm_title');
  document.getElementById('quit-confirm-body').textContent = t('quit_confirm_body');
  document.getElementById('quit-cancel-btn').textContent = t('cancel');
  document.getElementById('quit-confirm-btn').textContent = t('quit');

  // Control bar
  // ctrl-go removed — level-based flow
  document.getElementById('ctrl-restart').title = t('restart');
  document.getElementById('ctrl-random').textContent = t('random');
  updateHintBtn();

  // Pool label
  const poolLabel = document.querySelector('#pool-section h2');
  if (poolLabel) poolLabel.textContent = t('pieces_label');
  document.getElementById('pause-label').textContent = t('paused');

  // Welcome panel
  // Level card names are updated in updateWelcomeLevels()
  const wpDivider = document.querySelector('#welcome-panel .wp-divider');
  if (wpDivider) wpDivider.textContent = t('wp_or');
  updateWelcomeLevels();
  renderDailyChallengeCard();
  updateLevelNav();

  // Splash (if still present) — update text then reveal
  const _splashEl = document.getElementById('splash');
  const splashTagline = document.querySelector('#splash .tagline');
  if (splashTagline) splashTagline.innerHTML = t('splash_tagline');
  const splashTap = document.querySelector('#splash .tap-hint');
  if (splashTap) splashTap.textContent = t('splash_tap');
  if (_splashEl && !_splashEl.classList.contains('splash-ready')) {
    setTimeout(() => { if (_splashEl) _splashEl.classList.add('splash-ready'); }, 300);
  }

  // Help & story modal bodies (Pure mode / Steam: use stripped version without hints/energy/tasks/daily-challenge)
  document.getElementById('help-body').innerHTML = t(_helpBodyKey());
  // Show keyboard shortcuts section based on config
  var kbInline = document.getElementById('kb-shortcuts-inline');
  if (kbInline) {
    var _showKb = SHOW_KB_SHORTCUTS === true || (SHOW_KB_SHORTCUTS === 'auto' && window.matchMedia('(pointer: fine)').matches);
    if (_showKb) kbInline.style.display = '';
  }

  // Open feedback with app context passed via URL params (works in external browser on Android)
  window.openFeedback = function(extra) {
    var params = [];
    try { var au = getAuthUser(); if (au) { if (au.email) params.push('email=' + encodeURIComponent(au.email)); if (au.display_name) params.push('name=' + encodeURIComponent(au.display_name)); } } catch(e) {}
    try { params.push('uuid=' + encodeURIComponent(getBrowserUUID())); } catch(e) {}
    params.push('version=' + encodeURIComponent(APP_VERSION_NAME));
    params.push('lang=' + encodeURIComponent(currentLang));
    var hash = params.join('&') + (extra ? '&' + extra : '');
    window.open('feedback.html#' + hash);
  };

  // In-app feedback submit with offline queue
  window._submitFeedback = function() {
    var textEl = document.getElementById('feedback-text');
    var statusEl = document.getElementById('feedback-status');
    var btn = document.getElementById('feedback-send-btn');
    var text = (textEl.value || '').trim();
    if (!text) return;
    // Sanitize: strip HTML tags, cap length
    text = text.replace(/<[^>]*>/g, '').substring(0, 2000);
    if (!text) return;
    var payload = {
      type: 'general',
      message: text,
      version: APP_VERSION_NAME,
      lang: currentLang,
      platform: _isDemoMode ? 'electron-demo' : _isElectron ? 'electron' : /android/i.test(navigator.userAgent) ? 'android' : /iphone|ipad/i.test(navigator.userAgent) ? 'ios' : (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) ? 'pwa' : 'web',
      device: window.innerWidth + 'x' + window.innerHeight,
      origin: location.origin || location.protocol + '//' + location.host
    };
    try { payload.browser_uuid = getBrowserUUID(); } catch(e) {}
    // Email only if user explicitly typed it (never auto-attach from account)
    var feedbackEmail = document.getElementById('feedback-email');
    if (feedbackEmail && feedbackEmail.value.trim()) payload.email = feedbackEmail.value.trim();
    // Diagnostic context appended to message (backend doesn't have context field)
    // Append diagnostic context to message (backend schema has no context field)
    var ctxParts = [];
    ctxParts.push('tier=' + (typeof getPlayerTier === 'function' ? getPlayerTier() : ''));
    ctxParts.push('solved=' + parseInt(localStorage.getItem('octile_total_solved') || '0'));
    ctxParts.push('streak=' + ((typeof getStreak === 'function' ? getStreak().count : 0) || 0));
    ctxParts.push('dpr=' + (window.devicePixelRatio || 1));
    payload.message += '\n\n[ctx: ' + ctxParts.join(', ') + ']';

    statusEl.style.display = '';
    btn.disabled = true;

    if (typeof isOnline === 'function' && isOnline()) {
      // Online: submit immediately
      statusEl.textContent = t('feedback_sending');
      statusEl.className = '';
      fetch(WORKER_URL + '/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function(r) {
        if (r && r.ok) {
          statusEl.textContent = t('feedback_sent');
          statusEl.className = 'feedback-ok';
          textEl.value = '';
        } else {
          // API returned error — queue offline
          _queueFeedback(payload);
          statusEl.textContent = t('feedback_queued');
          statusEl.className = 'feedback-ok';
          textEl.value = '';
        }
        btn.disabled = false;
      }).catch(function() {
        _queueFeedback(payload);
        statusEl.textContent = t('feedback_queued');
        statusEl.className = 'feedback-ok';
        textEl.value = '';
        btn.disabled = false;
      });
    } else {
      // Offline: queue for later
      _queueFeedback(payload);
      statusEl.textContent = t('feedback_queued');
      statusEl.className = 'feedback-ok';
      textEl.value = '';
      btn.disabled = false;
    }
  };

  window._queueFeedback = function(payload) {
    try {
      var q = JSON.parse(localStorage.getItem('octile_feedback_queue') || '[]');
      q.push(payload);
      if (q.length > 10) q.shift();
      localStorage.setItem('octile_feedback_queue', JSON.stringify(q));
    } catch(e) {}
  };

  window._flushFeedbackQueue = function() {
    try {
      var q = JSON.parse(localStorage.getItem('octile_feedback_queue') || '[]');
      if (!q.length || !isOnline()) return;
      var item = q.shift();
      localStorage.setItem('octile_feedback_queue', JSON.stringify(q));
      fetch(WORKER_URL + '/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      }).catch(function() {
        // Re-queue on failure
        q.unshift(item);
        localStorage.setItem('octile_feedback_queue', JSON.stringify(q));
      });
    } catch(e) {}
  };

  // Build Help & About sections: Story → Feedback → Links
  var storyHtml = t('story_body');
  // Store links from config
  var storeLinkHtml = '';
  for (var _si = 0; _si < STORE_LINKS.length; _si++) {
    var _sl = STORE_LINKS[_si];
    if (_sl && _sl.url) {
      storeLinkHtml += '<a class="about-rate-btn" href="#" onclick="window.open(\'' + _sl.url.replace(/'/g, "\\'") + '\');return false">\u2B50 ' + t(_sl.label || 'about_rate') + '</a>';
    }
  }
  // Feedback section
  var feedbackHtml = '<div class="help-section">'
    + '<h3>' + t('feedback_title') + '</h3>'
    + '<div id="feedback-inline">'
    + '<textarea id="feedback-text" rows="3" placeholder="' + t('feedback_placeholder') + '" maxlength="2000"></textarea>'
    + '<input type="email" id="feedback-email" placeholder="' + t('feedback_email_placeholder') + '" autocomplete="email" />'
    + '<button id="feedback-send-btn" class="feedback-send">' + t('feedback_send') + '</button>'
    + '<div id="feedback-status" style="display:none"></div>'
    + '</div>'
    + storeLinkHtml
    + '</div>';
  // Legal links
  var linksHtml = '<div class="help-section help-legal">'
    + '<a href="#" onclick="window.open(\'terms.html#lang=' + currentLang + (_isElectron ? '&platform=steam' : '') + '\');return false">' + t('terms_link') + '</a>'
    + ' \u00B7 '
    + '<a href="#" onclick="window.open(\'privacy.html#lang=' + currentLang + (_isElectron ? '&platform=steam' : '') + '\');return false">' + t('privacy_link') + '</a>'
    + '<p class="app-version" onclick="if(window.OctileBridge&&OctileBridge.getDeviceInfo)prompt(\'Device Info\',OctileBridge.getDeviceInfo())">v' + APP_VERSION_NAME + '</p>'
    + '</div>';
  document.getElementById('story-body').innerHTML = storyHtml + feedbackHtml + linksHtml;
  // Bind feedback send button
  var feedbackBtn = document.getElementById('feedback-send-btn');
  if (feedbackBtn) {
    feedbackBtn.addEventListener('click', function() { _submitFeedback(); });
  }

  // Win flow static text
  document.getElementById('win-step1-title').textContent = t('win_title');
  document.getElementById('win-tap1').textContent = t('win_tap_continue');
  document.getElementById('win-step2-title').textContent = t('win_rewards_title');
  document.getElementById('win-tap2').textContent = t('win_tap_continue');
  document.getElementById('win-share-btn').innerHTML = t('win_share');
  document.getElementById('win-view-btn').textContent = t('win_view_board');
  document.getElementById('win-back-btn').textContent = t('win_back');
  document.getElementById('win-prev-btn').textContent = t('win_prev');
  document.getElementById('win-next-btn').innerHTML = t('win_next');
  document.getElementById('win-random-btn').textContent = t('win_random');
  document.getElementById('win-menu-btn').textContent = t('win_menu');

  // Energy display
  document.getElementById('energy-display').title = t('energy_title');
  document.getElementById('energy-modal-title').textContent = t('energy_title');
  updateEnergyDisplay();

  // Goals button & modal
  document.getElementById('settings-goals-label').textContent = t('menu_goals');
  document.getElementById('achieve-modal-title').textContent = t('goals_title');

  // Inbox button
  document.getElementById('settings-messages-label').textContent = t('menu_inbox');

  // Profile button
  document.getElementById('settings-profile-label').textContent = t('menu_profile');

  // Update banner
  document.getElementById('update-btn').textContent = t('update_btn');
  document.getElementById('update-dismiss').textContent = t('update_later');

  // Refresh tagline
  const taglines = getTaglines();
  const wpTagline = document.getElementById('wp-tagline');
  if (wpTagline) wpTagline.innerHTML = taglines[Math.floor(Math.random() * taglines.length)];
}

function setLang(pref) {
  _langPref = pref;
  localStorage.setItem('octile_lang', pref);
  currentLang = pref === 'system' ? _systemLang() : pref;
  applyLanguage();
}

// --- Auth ---

function getAuthUser() {
  try { return JSON.parse(localStorage.getItem('octile_auth_user') || 'null'); }
  catch { return null; }
}

function isAuthenticated() {
  return !!localStorage.getItem('octile_auth_token');
}

function getAuthHeaders() {
  var token = localStorage.getItem('octile_auth_token');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

// Keys preserved across logout (device-level, not user-level)
var _AUTH_KEEP_KEYS = [
  'octile_lang', 'octile-theme', 'octile_unlocked_themes',
  'octile_browser_uuid', 'octile_cookie_uuid', 'octile_onboarded', 'octile_tutorial_seen', 'octile_tut_step',
  'octile_debug', 'octile_sound',
  'octile_energy', 'octile_energy_day',
];

function _clearGameProgress() {
  var toRemove = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.startsWith('octile') && _AUTH_KEEP_KEYS.indexOf(k) < 0) {
      toRemove.push(k);
    }
  }
  for (var j = 0; j < toRemove.length; j++) localStorage.removeItem(toRemove[j]);
  // Refresh all displays to show zeroed state
  updateExpDisplay();
  updateDiamondDisplay();
  updateEnergyDisplay();
  updateWelcomeLevels();
}

function _storeAuthUser(data) {
  localStorage.setItem('octile_auth_user', JSON.stringify(data));
  if (data.refreshed_token) localStorage.setItem('octile_auth_token', data.refreshed_token);
  // Refresh profile modal if open
  try { if (document.getElementById('profile-modal').classList.contains('show')) showProfileModal(); } catch(e) {}
}

function authLogout() {
  localStorage.removeItem('octile_auth_token');
  localStorage.removeItem('octile_auth_user');
  _clearGameProgress();
}

function _authShowForm(name) {
  var forms = ['login', 'register', 'verify', 'forgot', 'reset'];
  for (var i = 0; i < forms.length; i++) {
    document.getElementById('auth-form-' + forms[i]).style.display = forms[i] === name ? '' : 'none';
  }
  document.getElementById('auth-error').textContent = '';
}

var _authErrorMap = {
  'Invalid verification code': 'auth_err_invalid_code',
  'Code expired, please register again': 'auth_err_code_expired',
  'Code expired, please request again': 'auth_err_code_expired',
  'Invalid email or password': 'auth_err_invalid_login',
  'Invalid email or password (min 6 chars)': 'auth_err_fields',
  'Email already registered': 'auth_err_already_registered',
  'Account not found': 'auth_err_not_found',
  'Already verified, please login': 'auth_err_already_verified',
  'Too many attempts, try again later': 'auth_err_rate_limit',
  'Failed to send email': 'auth_err_email_failed',
  'Email service unavailable': 'auth_err_email_failed',
};

function _authLocalizeError(detail) {
  if (!detail) return t('auth_err_network');
  var key = _authErrorMap[detail];
  return key ? t(key) : detail;
}

function _authSetError(msg) {
  document.getElementById('auth-error').textContent = msg;
}

function _authSetLoading(btnId, loading) {
  var btn = document.getElementById(btnId);
  btn.disabled = loading;
  if (loading) btn.dataset.origText = btn.textContent;
  btn.textContent = loading ? '...' : (btn.dataset.origText || btn.textContent);
}

// Subtle sign-in hint — shown once per session at meaningful moments
var _signInHintShown = false;
function _maybeShowSignInHint() {
  if (!isAuthEnabled()) return; // no auth UI
  if (isAuthenticated() || _signInHintShown) return;
  _signInHintShown = true;
  var el = document.getElementById('encourage-toast');
  if (el) {
    el.textContent = t('hint_save_progress');
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 4500);
  }
}

function showAuthModal() {
  // Reset magic link state
  _magicAuthDone = false;
  _stopMagicPoll();
  // Show magic link form, hide sent confirmation
  document.getElementById('auth-form-magic').style.display = '';
  document.getElementById('auth-form-magic-sent').style.display = 'none';
  document.getElementById('auth-name').value = '';
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-error').textContent = '';
  document.getElementById('auth-title').textContent = t('auth_signin');
  document.getElementById('auth-magic-desc').textContent = t('auth_magic_desc');
  document.getElementById('auth-magic-btn').textContent = t('auth_magic_send');
  document.getElementById('auth-magic-sent-msg').textContent = t('auth_magic_sent');
  document.getElementById('auth-magic-sent-hint').textContent = t('auth_magic_hint');
  document.getElementById('auth-magic-resend').textContent = t('auth_magic_resend');
  // Agree checkbox
  var agreeCheck = document.getElementById('auth-agree-check');
  agreeCheck.checked = false;
  document.getElementById('auth-magic-btn').disabled = true;
  document.getElementById('auth-agree-text').innerHTML = t('auth_agree')
    .replace('{terms}', t('terms_link'))
    .replace('{privacy}', t('privacy_link'));
  document.getElementById('auth-modal').classList.add('show');
}

var _magicLinkEmail = '';
var _magicRequestId = null;
var _magicPollTimer = null;
var _magicAuthDone = false;

function _stopMagicPoll() {
  if (_magicPollTimer) { clearInterval(_magicPollTimer); _magicPollTimer = null; }
  _magicRequestId = null;
}

function _startMagicPoll(requestId) {
  _stopMagicPoll();
  _magicRequestId = requestId;
  _magicPollTimer = setInterval(async function() {
    if (_magicAuthDone || !_magicRequestId) { _stopMagicPoll(); return; }
    try {
      var res = await fetch(WORKER_URL + '/auth/magic-link/status?id=' + encodeURIComponent(_magicRequestId), {
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return;
      var data = await res.json();
      if (data.status === 'verified' && data.access_token) {
        _stopMagicPoll();
        if (_magicAuthDone) return;
        _authOnSuccess({ access_token: data.access_token, user: { display_name: data.display_name || '', email: data.email || '' } });
        // Fetch full user info
        fetch(WORKER_URL + '/auth/me', { headers: { 'Authorization': 'Bearer ' + data.access_token } })
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(u) { if (u) _storeAuthUser(u); })
          .catch(function() {});
      } else if (data.status === 'expired') {
        _stopMagicPoll();
      }
    } catch(e) { /* network error, retry next interval */ }
  }, 3000);
}

async function _sendMagicLink() {
  var email = document.getElementById('auth-email').value.trim();
  if (!email) return;
  _magicLinkEmail = email;
  _magicAuthDone = false;
  var btn = document.getElementById('auth-magic-btn');
  var errEl = document.getElementById('auth-error');
  btn.disabled = true;
  errEl.textContent = '';
  try {
    var res = await fetch(WORKER_URL + '/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, display_name: document.getElementById('auth-name').value.trim() || null, browser_uuid: getBrowserUUID(), lang: currentLang })
    });
    var data = await res.json();
    if (!res.ok) throw new Error(_authLocalizeError(data.detail));
    // Show "check your email" state with countdown
    document.getElementById('auth-form-magic').style.display = 'none';
    document.getElementById('auth-form-magic-sent').style.display = '';
    document.getElementById('auth-magic-sent-email').textContent = email;
    document.getElementById('auth-magic-resend').style.display = 'none';
    _startMagicLinkCountdown();
    // Start polling if backend returned a request_id
    if (data.request_id) _startMagicPoll(data.request_id);
  } catch(e) {
    var msg = e.message || '';
    if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('network')) {
      errEl.textContent = t('auth_magic_network_error');
    } else {
      errEl.textContent = msg || t('auth_magic_send_failed');
    }
    btn.disabled = false;
  }
}

var _magicCountdownTimer = null;
function _startMagicLinkCountdown() {
  if (_magicCountdownTimer) clearInterval(_magicCountdownTimer);
  var remaining = 120; // 2 minutes
  var cdEl = document.getElementById('auth-magic-countdown');
  var resendBtn = document.getElementById('auth-magic-resend');
  resendBtn.style.display = 'none';
  cdEl.textContent = t('auth_magic_countdown').replace('{sec}', remaining);
  _magicCountdownTimer = setInterval(function() {
    remaining--;
    if (remaining <= 0) {
      clearInterval(_magicCountdownTimer);
      _magicCountdownTimer = null;
      _stopMagicPoll();
      cdEl.textContent = t('auth_magic_expired_hint');
      resendBtn.style.display = '';
    } else {
      cdEl.textContent = t('auth_magic_countdown').replace('{sec}', remaining);
    }
  }, 1000);
}

function _authOnSuccess(data) {
  if (_magicAuthDone) return; // guard against double-fire (poll + postMessage race)
  _magicAuthDone = true;
  _stopMagicPoll();
  if (_magicCountdownTimer) { clearInterval(_magicCountdownTimer); _magicCountdownTimer = null; }
  localStorage.setItem('octile_auth_token', data.access_token);
  localStorage.setItem('octile_auth_user', JSON.stringify(data.user));
  document.getElementById('auth-modal').classList.remove('show');
  // Sync: push local progress (may include anonymous play) then pull+merge
  syncProgress().then(() => {
    if (document.getElementById('profile-modal').classList.contains('show')) {
      showProfileModal();
    }
  });
}

var _authVerifyEmail = '';

async function _authDoRegister() {
  var name = document.getElementById('auth-reg-name').value.trim();
  var email = document.getElementById('auth-reg-email').value.trim();
  var password = document.getElementById('auth-reg-password').value;
  if (!email || !password || password.length < 6) {
    _authSetError(t('auth_err_fields'));
    return;
  }
  _authSetLoading('auth-register-btn', true);
  _authSetError('');
  try {
    var res = await fetch(WORKER_URL + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, display_name: name || email.split('@')[0], browser_uuid: getBrowserUUID(), lang: currentLang }),
    });
    var data = await res.json();
    if (!res.ok) { _authSetError(_authLocalizeError(data.detail)); return; }
    _authVerifyEmail = email;
    document.getElementById('auth-verify-msg').textContent = t('auth_check_email').replace('{email}', email);
    document.getElementById('auth-title').textContent = t('auth_verify');
    _authShowForm('verify');
  } catch (e) {
    _authSetError(t('auth_err_network'));
  } finally {
    _authSetLoading('auth-register-btn', false);
  }
}

async function _authDoVerify() {
  var otp = document.getElementById('auth-otp').value.trim();
  if (!otp || otp.length !== 6) { _authSetError(t('auth_err_otp')); return; }
  _authSetLoading('auth-verify-btn', true);
  _authSetError('');
  try {
    var res = await fetch(WORKER_URL + '/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: _authVerifyEmail, otp_code: otp }),
    });
    var data = await res.json();
    if (!res.ok) { _authSetError(_authLocalizeError(data.detail)); return; }
    _authOnSuccess(data);
  } catch (e) {
    _authSetError(t('auth_err_network'));
  } finally {
    _authSetLoading('auth-verify-btn', false);
  }
}

async function _authDoLogin() {
  var email = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value;
  if (!email || !password) { _authSetError(t('auth_err_fields')); return; }
  _authSetLoading('auth-login-btn', true);
  _authSetError('');
  try {
    var res = await fetch(WORKER_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, browser_uuid: getBrowserUUID() }),
    });
    var data = await res.json();
    if (!res.ok) { _authSetError(_authLocalizeError(data.detail)); return; }
    _authOnSuccess(data);
  } catch (e) {
    _authSetError(t('auth_err_network'));
  } finally {
    _authSetLoading('auth-login-btn', false);
  }
}

async function _authDoForgot() {
  var email = document.getElementById('auth-forgot-email').value.trim();
  if (!email) { _authSetError(t('auth_err_fields')); return; }
  _authSetLoading('auth-forgot-btn', true);
  _authSetError('');
  try {
    var res = await fetch(WORKER_URL + '/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, lang: currentLang }),
    });
    var data = await res.json();
    if (!res.ok) { _authSetError(_authLocalizeError(data.detail)); return; }
    _authVerifyEmail = email;
    document.getElementById('auth-reset-msg').textContent = t('auth_check_email').replace('{email}', email);
    document.getElementById('auth-title').textContent = t('auth_reset');
    _authShowForm('reset');
  } catch (e) {
    _authSetError(t('auth_err_network'));
  } finally {
    _authSetLoading('auth-forgot-btn', false);
  }
}

async function _authDoReset() {
  var otp = document.getElementById('auth-reset-otp').value.trim();
  var password = document.getElementById('auth-reset-password').value;
  if (!otp || otp.length !== 6 || !password || password.length < 6) {
    _authSetError(t('auth_err_fields'));
    return;
  }
  _authSetLoading('auth-reset-btn', true);
  _authSetError('');
  try {
    var res = await fetch(WORKER_URL + '/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: _authVerifyEmail, otp_code: otp, new_password: password }),
    });
    var data = await res.json();
    if (!res.ok) { _authSetError(_authLocalizeError(data.detail)); return; }
    document.getElementById('auth-title').textContent = t('auth_signin');
    _authShowForm('login');
    _authSetError('');
  } catch (e) {
    _authSetError(t('auth_err_network'));
  } finally {
    _authSetLoading('auth-reset-btn', false);
  }
}

// --- Google OAuth ---

function loginWithGoogle() {
  var uuid = getBrowserUUID();
  if (window.OctileBridge) {
    // Android WebView — use Credential Manager native bottom sheet
    try {
      OctileBridge.startGoogleLogin(uuid);
    } catch (e) {
      alert('Bridge error: ' + e.message);
    }
  } else {
    // Browser/PWA — redirect to worker auth endpoint
    var returnUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = WORKER_URL + '/auth/google?source=web&browser_uuid=' + encodeURIComponent(uuid) + '&return_url=' + returnUrl;
  }
}

// Handle web redirect callback (URL has ?auth_token=...&auth_name=...)
function _checkAuthCallback() {
  var params = new URLSearchParams(window.location.search);
  var token = params.get('auth_token');
  var name = params.get('auth_name');
  var error = params.get('auth_error');
  if (error) {
    console.warn('[Octile] Google auth error:', error);
    // Clean URL
    history.replaceState(null, '', window.location.pathname);
    return;
  }
  if (token) {
    // Decode name (URL-encoded)
    name = name ? decodeURIComponent(name) : '';
    _authOnSuccess({ access_token: token, user: { display_name: name, email: '' } });
    // Fetch full user info to get email
    fetch(WORKER_URL + '/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data) _storeAuthUser(data);
      })
      .catch(function() {});
    // Clean URL
    history.replaceState(null, '', window.location.pathname);
  }
}

// Listen for magic link postMessage from verify page
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'octile-auth' && e.data.token) {
    _authOnSuccess({ access_token: e.data.token, user: { display_name: e.data.name || '', email: '' } });
    fetch(WORKER_URL + '/auth/me', { headers: { 'Authorization': 'Bearer ' + e.data.token } })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) { if (data) _storeAuthUser(data); })
      .catch(function() {});
    document.getElementById('auth-modal').classList.remove('show');
  }
});

// Handle Android deep link callback (native injects this)
window.onGoogleAuthSuccess = function(token, name) {
  _authOnSuccess({ access_token: token, user: { display_name: name, email: '' } });
  // Fetch full user info
  fetch(WORKER_URL + '/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (data) _storeAuthUser(data);
    })
    .catch(function() {});
};

window.onGoogleAuthError = function(errorType) {
  console.warn('[Octile] Google auth error:', errorType);
  var msg = errorType || 'Unknown error';
  if (msg.indexOf('Canceled') >= 0 || msg.indexOf('cancelled') >= 0) return; // user cancelled, no toast
  alert('Google Sign-In: ' + msg);
};

// Check for pending auth from cold-launch deep link (native set _pendingAuth before onGoogleAuthSuccess was defined)
function _checkPendingAuth() {
  if (window._pendingAuth) {
    var pa = window._pendingAuth;
    delete window._pendingAuth;
    window.onGoogleAuthSuccess(pa.token, pa.name);
  }
}

// =====================================================================
// MESSAGE CENTER
// =====================================================================

var MSG_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // overridden by config.json messageMaxAgeDays

function getMessages() {
  try {
    var data = JSON.parse(localStorage.getItem('octile_messages') || '{"items":[],"lastReadAt":0}');
    // Prune old messages
    var cutoff = Date.now() - MSG_MAX_AGE_MS;
    data.items = data.items.filter(function(m) { return m.timestamp > cutoff; });
    return data;
  } catch(e) { return { items: [], lastReadAt: 0 }; }
}
function saveMessages(data) { localStorage.setItem('octile_messages', JSON.stringify(data)); }

function addMessage(type, icon, titleKey, bodyKey, extraData) {
  // D1/Pure/Demo mode: no notifications (no meta-game)
  if (_noMeta()) return null;
  var data = getMessages();
  var msg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: type, icon: icon, titleKey: titleKey, bodyKey: bodyKey || '',
    timestamp: Date.now(), read: false, data: extraData || {}
  };
  data.items.unshift(msg);
  // Keep max 50 messages
  if (data.items.length > 50) data.items = data.items.slice(0, 50);
  saveMessages(data);
  updateMessageBadge();
  return msg;
}

function addClaimableMultiplier(value) {
  // D1/Pure/Demo mode: no notifications
  if (_noMeta()) return;
  var data = getMessages();
  // Check limit: max 1 pending 2x and 1 pending 3x
  var existing = data.items.filter(function(m) { return m.type === 'multiplier_claim' && !m.data.claimed && m.data.value === value; });
  if (existing.length >= 1) return; // already has one pending
  var expiresAt = Date.now() + 3 * 24 * 60 * 60 * 1000; // 3 days
  var msg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: 'multiplier_claim', icon: '\uD83D\uDC8E',
    titleKey: value === 3 ? 'multiplier_3x_title' : 'multiplier_2x_title',
    bodyKey: value === 3 ? 'multiplier_3x_desc' : 'multiplier_2x_desc',
    timestamp: Date.now(), read: false,
    data: { value: value, expiresAt: expiresAt, claimed: false }
  };
  data.items.unshift(msg);
  saveMessages(data);
  updateMessageBadge();
}

function claimMultiplierFromMessage(msgId) {
  var data = getMessages();
  var msg = data.items.find(function(m) { return m.id === msgId; });
  if (!msg || msg.data.claimed || msg.data.expiresAt < Date.now()) return;
  msg.data.claimed = true;
  saveMessages(data);
  showMultiplierConfirm(msg.data.value);
}

function getUnreadCount() {
  var data = getMessages();
  return data.items.filter(function(m) { return !m.read; }).length;
}

function updateMessageBadge() {
  var count = getUnreadCount();
  var badge = document.getElementById('messages-badge');
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}

function formatRelativeTime(ts) {
  var diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return t('messages_time_now');
  if (diff < 3600) return t('messages_time_min').replace('{n}', Math.floor(diff / 60));
  if (diff < 86400) return t('messages_time_hour').replace('{n}', Math.floor(diff / 3600));
  return t('messages_time_day').replace('{n}', Math.floor(diff / 86400));
}

function _msgTranslate(key, params) {
  var s = t(key);
  if (s === key) return key; // key not found, return as-is
  if (params) {
    for (var k in params) {
      if (params.hasOwnProperty(k)) s = s.replace('{' + k + '}', params[k]);
    }
  }
  return s;
}

function renderMessages() {
  var data = getMessages();
  var list = document.getElementById('messages-list');
  var empty = document.getElementById('messages-empty');
  if (data.items.length === 0) {
    list.innerHTML = '';
    empty.textContent = t('messages_empty');
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  var html = '';
  for (var i = 0; i < data.items.length; i++) {
    var m = data.items[i];
    var cls = m.read ? '' : ' unread';
    cls += ' msg-type-' + (m.type || 'system');
    html += '<div class="msg-item' + cls + '" data-id="' + m.id + '">';
    html += '<div class="msg-icon">' + m.icon + '</div>';
    html += '<div class="msg-body">';
    html += '<div class="msg-type-tag">' + t('msg_type_' + (m.type || 'system')) + '</div>';
    // Resolve translation keys at render time (not at save time)
    var _msgTitle = m.titleKey ? _msgTranslate(m.titleKey, m.data) : (m.title || '');
    var _msgBody = m.bodyKey ? _msgTranslate(m.bodyKey, m.data) : (m.body || '');
    html += '<div class="msg-title">' + escapeHtml(_msgTitle) + '</div>';
    if (_msgBody) html += '<div class="msg-desc">' + escapeHtml(_msgBody) + '</div>';
    html += '<div class="msg-time">' + formatRelativeTime(m.timestamp) + '</div>';
    // Actions
    html += '<div class="msg-actions">';
    // Type-specific actions (multiplier claims only when diamond_multiplier feature is on)
    if (m.type === 'multiplier_claim' && _feature('diamond_multiplier')) {
      if (!m.data.claimed && m.data.expiresAt > Date.now()) {
        var expDays = Math.ceil((m.data.expiresAt - Date.now()) / 86400000);
        html += '<button class="msg-action-btn msg-claim-btn" data-id="' + m.id + '">' + t('tasks_claim') + ' \u00B7 ' + t('msg_expires_in').replace('{n}', expDays) + '</button>';
      } else if (m.data.claimed) {
        html += '<span class="task-claimed-tag">' + t('tasks_claimed') + '</span>';
      } else if (m.data.expiresAt <= Date.now()) {
        html += '<span class="msg-desc" style="color:#e74c3c">' + t('league_inactive') + '</span>';
      }
    }
    if (m.type === 'achievement') {
      var _achClaimed = getClaimedAchievements();
      if (m.data && m.data.achId && !_achClaimed[m.data.achId]) {
        html += '<button class="msg-action-btn msg-ach-claim-btn" data-achid="' + m.data.achId + '">' + t('tasks_claim') + ' \uD83D\uDC8E</button>';
      }
    }
    // Share button for all message types
    html += '<button class="msg-action-btn msg-share-btn" data-id="' + m.id + '">' + t('messages_share') + '</button>';
    html += '</div>';
    html += '</div></div>';
  }
  list.innerHTML = html;
  // Bind claim buttons
  list.querySelectorAll('.msg-claim-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      claimMultiplierFromMessage(this.getAttribute('data-id'));
      document.getElementById('messages-modal').classList.remove('show');
    });
  });
  list.querySelectorAll('.msg-ach-claim-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var achId = this.getAttribute('data-achid');
      claimAchievementDiamonds(achId);
      renderMessages(); // re-render to hide claim button
    });
  });
  list.querySelectorAll('.msg-share-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var msgId = this.getAttribute('data-id');
      var msg = data.items.find(function(m) { return m.id === msgId; });
      if (msg && navigator.share) {
        var shareTitle = msg.titleKey ? _msgTranslate(msg.titleKey, msg.data) : (msg.title || '');
        var shareBody = msg.bodyKey ? _msgTranslate(msg.bodyKey, msg.data) : (msg.body || '');
        navigator.share({ title: 'Octile', text: shareTitle + ': ' + shareBody }).catch(function(){});
      }
    });
  });
}

function showMessagesModal() {
  if (!_feature('messages')) return;
  document.getElementById('messages-modal-title').textContent = t('messages_title');
  renderMessages();
  document.getElementById('messages-modal').classList.add('show');
  // Mark all read after 500ms
  setTimeout(function() {
    var data = getMessages();
    data.items.forEach(function(m) { m.read = true; });
    data.lastReadAt = Date.now();
    saveMessages(data);
    updateMessageBadge();
  }, 500);
}

// =====================================================================
// DAILY SPECIAL TASKS
// =====================================================================

var DAILY_TASK_POOL = [
  // Always available
  { id: 'finish_2_puzzles', target: 2, reward: 15, counter: 'solves' },
  { id: 'finish_3_puzzles', target: 3, reward: 20, counter: 'solves' },
  { id: 'finish_5_puzzles', target: 5, reward: 35, counter: 'solves' },
  { id: 'get_1_a_grade',    target: 1, reward: 15, counter: 'aGrades' },
  { id: 'get_2_a_grades',   target: 2, reward: 30, counter: 'aGrades' },
  { id: 'get_3_a_grades',   target: 3, reward: 50, counter: 'aGrades' },
  { id: 'play_5_min',       target: 5, reward: 10, counter: 'playMinutes' },
  { id: 'play_10_min',      target: 10, reward: 20, counter: 'playMinutes' },
  { id: 'solve_under_par',  target: 1, reward: 25, counter: 'underPar' },
  { id: 'solve_2_under_par',target: 2, reward: 40, counter: 'underPar' },
  { id: 'solve_no_hints',   target: 1, reward: 25, counter: 'noHints' },
  { id: 'get_1_s_grade',    target: 1, reward: 40, counter: 'sGrades' },
  { id: 'streak_3_puzzles', target: 3, reward: 35, counter: 'sessionStreak' },
  // Requires medium unlocked
  { id: 'try_medium',       target: 1, reward: 15, counter: 'mediumSolves', req: 'medium' },
  // Requires hard unlocked
  { id: 'try_hard',         target: 1, reward: 20, counter: 'hardSolves', req: 'hard' },
  // Requires hell unlocked
  { id: 'try_nightmare',    target: 1, reward: 30, counter: 'hellSolves', req: 'hell' },
];
var DAILY_TASK_BONUS = 50; // overridden by config.json dailyTaskBonus
var _sessionStreak = 0; // consecutive solves this session

function dailyTaskSeed(dateStr) {
  var h = 0;
  for (var i = 0; i < dateStr.length; i++) h = ((h << 5) - h + dateStr.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getTodayStr() { return new Date().toISOString().slice(0, 10); }

function getDailyTaskCounters() {
  try {
    var d = JSON.parse(localStorage.getItem('octile_daily_task_counters') || '{}');
    if (d.date !== getTodayStr()) return { date: getTodayStr(), solves: 0, aGrades: 0, underPar: 0, noHints: 0, hardSolves: 0, hellSolves: 0, playMinutes: 0, sessionStreak: 0 };
    return d;
  } catch(e) { return { date: getTodayStr(), solves: 0, aGrades: 0, underPar: 0, noHints: 0, hardSolves: 0, hellSolves: 0, playMinutes: 0, sessionStreak: 0 }; }
}
function saveDailyTaskCounters(c) { localStorage.setItem('octile_daily_task_counters', JSON.stringify(c)); }

function updateDailyTaskCounters(grade, elapsed, level) {
  if (!_feature('daily_tasks')) return;
  var c = getDailyTaskCounters();
  c.solves = (c.solves || 0) + 1;
  if (grade === 'S' || grade === 'A') c.aGrades = (c.aGrades || 0) + 1;
  if (grade === 'S') c.sGrades = (c.sGrades || 0) + 1;
  var par = (PAR_TIMES || {})[level] || 90;
  if (elapsed <= par) c.underPar = (c.underPar || 0) + 1;
  if (_hintsThisPuzzle === 0) c.noHints = (c.noHints || 0) + 1;
  if (level === 'medium') c.mediumSolves = (c.mediumSolves || 0) + 1;
  if (level === 'hard') c.hardSolves = (c.hardSolves || 0) + 1;
  if (level === 'hell') c.hellSolves = (c.hellSolves || 0) + 1;
  c.playMinutes = Math.round(((c.playMinutes || 0) + elapsed / 60) * 10) / 10;
  _sessionStreak++;
  c.sessionStreak = _sessionStreak;
  c.date = getTodayStr();
  saveDailyTaskCounters(c);
}

function getDailyTasks() {
  try {
    var d = JSON.parse(localStorage.getItem('octile_daily_tasks') || '{}');
    if (d.date === getTodayStr() && d.tasks && d.tasks.length === 3) return d;
  } catch(e) {}
  return generateDailyTasks();
}

function generateDailyTasks() {
  var dateStr = getTodayStr();
  var seed = dailyTaskSeed(dateStr);
  // Filter pool by unlocked levels
  var unlocked = { easy: true };
  if (typeof getLevelProgress === 'function' && typeof getEffectiveLevelTotal === 'function') {
    if (getLevelProgress('easy') >= getEffectiveLevelTotal('easy')) unlocked.medium = true;
    if (unlocked.medium && getLevelProgress('medium') >= getEffectiveLevelTotal('medium')) unlocked.hard = true;
    if (unlocked.hard && getLevelProgress('hard') >= getEffectiveLevelTotal('hard')) unlocked.hell = true;
  }
  // Also unlock based on any progress (player may have played via random)
  if (getLevelProgress('medium') > 0) unlocked.medium = true;
  if (getLevelProgress('hard') > 0) unlocked.hard = true;
  if (getLevelProgress('hell') > 0) unlocked.hell = true;
  var pool = DAILY_TASK_POOL.filter(function(t) {
    return !t.req || unlocked[t.req];
  });
  for (var i = pool.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    var j = seed % (i + 1);
    var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  var picked = pool.slice(0, 3);
  var tasks = picked.map(function(p) {
    return { id: p.id, target: p.target, progress: 0, reward: p.reward, claimed: false, counter: p.counter };
  });
  var data = { date: dateStr, tasks: tasks, bonusClaimed: false };
  localStorage.setItem('octile_daily_tasks', JSON.stringify(data));
  return data;
}

function updateDailyTaskProgress() {
  var data = getDailyTasks();
  var counters = getDailyTaskCounters();
  for (var i = 0; i < data.tasks.length; i++) {
    var task = data.tasks[i];
    task.progress = Math.min(counters[task.counter] || 0, task.target);
  }
  localStorage.setItem('octile_daily_tasks', JSON.stringify(data));
  checkDailyTaskNotification();
}

function claimDailyTaskReward(idx) {
  var data = getDailyTasks();
  var task = data.tasks[idx];
  if (!task || task.claimed || task.progress < task.target) return;
  task.claimed = true;
  addDiamonds(task.reward);
  localStorage.setItem('octile_daily_tasks', JSON.stringify(data));
  // Check if all 3 claimed for bonus
  var allClaimed = data.tasks.every(function(t) { return t.claimed; });
  var bonusAwarded = false;
  if (allClaimed && !data.bonusClaimed) {
    data.bonusClaimed = true;
    addDiamonds(DAILY_TASK_BONUS);
    localStorage.setItem('octile_daily_tasks', JSON.stringify(data));
    addMessage('daily_tasks', '\u2705', 'tasks_bonus_claimed', '', { diamonds: DAILY_TASK_BONUS });
    bonusAwarded = true;
  }
  // Show unified reward modal
  var rewards = [{ icon: '\uD83D\uDC8E', value: task.reward, label: t('task_' + task.id) }];
  if (bonusAwarded) rewards.push({ icon: '\uD83C\uDF89', value: DAILY_TASK_BONUS, label: t('reward_all_tasks_bonus') });
  showRewardModal({
    title: bonusAwarded ? t('reward_all_done') : t('reward_task_done'),
    reason: t('task_' + task.id),
    rewards: rewards,
    primary: { text: t('reward_continue'), action: function() {} },
    secondary: { text: t('reward_view_goals'), action: function() { showGoalsModal('tasks'); } }
  });
}

function checkDailyTaskNotification() {
  var dot = document.querySelector('.goals-dot');
  if (!dot) return;
  var hasClaimable = false;
  if (_feature('daily_tasks')) {
    var data = getDailyTasks();
    hasClaimable = data.tasks.some(function(task) { return task.progress >= task.target && !task.claimed; });
  }
  // Also check unclaimed achievements
  if (!hasClaimable) {
    var unlocked = getUnlockedAchievements();
    var claimed = getClaimedAchievements();
    for (var achId in unlocked) {
      if (unlocked[achId] && !claimed[achId]) { hasClaimable = true; break; }
    }
  }
  dot.classList.toggle('show', hasClaimable);
}

function getDailyTaskResetCountdown() {
  var now = new Date();
  var midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  var diff = Math.floor((midnight - now) / 1000);
  var h = Math.floor(diff / 3600);
  var m = Math.floor((diff % 3600) / 60);
  return h + 'h ' + m + 'm';
}

function renderDailyTasks() {
  // Tasks now render inside Goals modal via _renderTasksInGrid()
}

function showDailyTasksModal() {
  if (!_feature('daily_tasks')) return;
  showGoalsModal('tasks');
}

// =====================================================================
// DIAMOND MULTIPLIER (2x / 3x)
// =====================================================================

var MULTIPLIER_DURATION_MS = 10 * 60 * 1000; // 10 minutes
var MULTIPLIER_TIME_WINDOWS = [{ start: 12, end: 13 }, { start: 20, end: 21 }];
var CONSECUTIVE_A_FOR_3X = 3;
var _multiplierInterval = null;

function getMultiplierState() {
  try {
    var s = JSON.parse(localStorage.getItem('octile_multiplier') || '{}');
    if (s.expiresAt && s.expiresAt <= Date.now()) {
      // Expired — clear
      localStorage.removeItem('octile_multiplier');
      return { type: null, value: 1, expiresAt: null };
    }
    return s.value ? s : { type: null, value: 1, expiresAt: null };
  } catch(e) { return { type: null, value: 1, expiresAt: null }; }
}
function saveMultiplierState(s) { localStorage.setItem('octile_multiplier', JSON.stringify(s)); }

function getMultiplierDaily() {
  try {
    var d = JSON.parse(localStorage.getItem('octile_multiplier_daily') || '{}');
    if (d.date !== getTodayStr()) return { date: getTodayStr(), threeXUsed: false, consecutiveAGrades: 0 };
    return d;
  } catch(e) { return { date: getTodayStr(), threeXUsed: false, consecutiveAGrades: 0 }; }
}
function saveMultiplierDaily(d) { localStorage.setItem('octile_multiplier_daily', JSON.stringify(d)); }

function getActiveMultiplier() {
  var s = getMultiplierState();
  return (s.value && s.expiresAt && s.expiresAt > Date.now()) ? s.value : 1;
}

function isInTimeWindow() {
  var h = new Date().getHours();
  return MULTIPLIER_TIME_WINDOWS.some(function(w) { return h >= w.start && h < w.end; });
}

function checkTimeWindowMultiplier() {
  if (!_feature('diamond_multiplier')) return;
  if (!isInTimeWindow()) return;
  var current = getActiveMultiplier();
  if (current >= 2) return; // already have equal or better
  // Check if we already offered 2x this hour (avoid spamming)
  var daily = getMultiplierDaily();
  var lastOffer = daily._lastTimeWindowOffer || 0;
  var hour = new Date().getHours();
  if (lastOffer === hour) return;
  daily._lastTimeWindowOffer = hour;
  saveMultiplierDaily(daily);
  showMultiplierConfirm(2);
}

function checkConsecutiveAGrades(grade) {
  if (!_feature('diamond_multiplier')) return;
  var daily = getMultiplierDaily();
  if (grade === 'S' || grade === 'A') {
    daily.consecutiveAGrades = (daily.consecutiveAGrades || 0) + 1;
  } else {
    daily.consecutiveAGrades = 0;
  }
  saveMultiplierDaily(daily);
  if (daily.consecutiveAGrades >= CONSECUTIVE_A_FOR_3X && !daily.threeXUsed) {
    daily.consecutiveAGrades = 0;
    daily.threeXUsed = true; // mark used immediately — once per day
    saveMultiplierDaily(daily);
    var current = getActiveMultiplier();
    if (current >= 3) {
      addClaimableMultiplier(3);
    } else {
      showMultiplierConfirm(3);
    }
  }
}

function showMultiplierConfirm(value) {
  var modal = document.getElementById('multiplier-confirm-modal');
  var content = document.getElementById('multiplier-confirm-content');
  content.className = value === 3 ? 'x3' : '';
  document.getElementById('multiplier-confirm-icon').textContent = value === 3 ? '\uD83D\uDC8E\u2728' : '\uD83D\uDC8E';
  document.getElementById('multiplier-confirm-title').textContent = value === 3 ? t('multiplier_3x_title') : t('multiplier_2x_title');
  document.getElementById('multiplier-confirm-desc').textContent = value === 3 ? t('multiplier_3x_desc') : t('multiplier_2x_desc');
  document.getElementById('multiplier-confirm-duration').textContent = t('multiplier_duration').replace('{minutes}', Math.round(MULTIPLIER_DURATION_MS / 60000));
  document.getElementById('multiplier-confirm-start').textContent = t('multiplier_start');
  document.getElementById('multiplier-confirm-skip').textContent = t('multiplier_skip');
  // Store pending value
  modal._pendingValue = value;
  modal.classList.add('show');
}

function activateMultiplier(value) {
  var state = {
    type: value === 3 ? 'consecutive' : 'time_window',
    value: value,
    expiresAt: Date.now() + MULTIPLIER_DURATION_MS,
    activatedAt: Date.now()
  };
  saveMultiplierState(state);
  if (value === 3) {
    var daily = getMultiplierDaily();
    daily.threeXUsed = true;
    saveMultiplierDaily(daily);
  }
  startMultiplierCountdown();
  updateMultiplierDisplay();
  setTimeout(function() { fxDiamondSparkle(document.getElementById('multiplier-display')); }, 400);
  addMessage('multiplier', '\uD83D\uDC8E', 'multiplier_active', 'multiplier_toast_on', { value: value });
  // Show unified reward modal
  showRewardModal({
    title: t(value === 3 ? 'multiplier_3x_title' : 'multiplier_2x_title'),
    reason: t(value === 3 ? 'multiplier_3x_desc' : 'multiplier_2x_desc'),
    rewards: [{ icon: '\uD83D\uDC8E', value: value, label: 'x ' + t('reward_multiplier_for').replace('{min}', Math.round(MULTIPLIER_DURATION_MS / 60000)) }],
    primary: { text: t('reward_start_playing'), action: function() {} }
  });
}

function startMultiplierCountdown() {
  if (_multiplierInterval) clearInterval(_multiplierInterval);
  updateMultiplierDisplay();
  _multiplierInterval = setInterval(function() {
    var s = getMultiplierState();
    if (!s.expiresAt || s.expiresAt <= Date.now()) {
      clearInterval(_multiplierInterval);
      _multiplierInterval = null;
      updateMultiplierDisplay();
      return;
    }
    var remaining = Math.ceil((s.expiresAt - Date.now()) / 1000);
    var m = Math.floor(remaining / 60);
    var sec = remaining % 60;
    document.getElementById('multiplier-timer').textContent = m + ':' + (sec < 10 ? '0' : '') + sec;
  }, 1000);
}

function updateMultiplierDisplay() {
  var el = document.getElementById('multiplier-display');
  var s = getMultiplierState();
  if (s.value > 1 && s.expiresAt && s.expiresAt > Date.now()) {
    document.getElementById('multiplier-value').textContent = s.value + 'x';
    el.classList.toggle('x3', s.value === 3);
    el.classList.add('active');
  } else {
    el.classList.remove('active');
  }
}

function applyDiamondMultiplier(baseDiamonds) {
  return baseDiamonds * getActiveMultiplier();
}

function checkMultiplierOnLoad() {
  if (!_feature('diamond_multiplier')) {
    var mEl = document.getElementById('multiplier-display');
    if (mEl) mEl.classList.remove('active');
    return;
  }
  var s = getMultiplierState();
  if (s.value > 1 && s.expiresAt && s.expiresAt > Date.now()) {
    startMultiplierCountdown();
  }
  updateMultiplierDisplay();
  // Periodic time window check
  setInterval(checkTimeWindowMultiplier, 60000);
  checkTimeWindowMultiplier();
}

// --- Progress Sync ---

function _getLocalProgress() {
  var grades; try { grades = JSON.parse(localStorage.getItem('octile_grades') || '{}'); } catch(e) { grades = {}; }
  if (!grades.S) grades = { S: 0, A: 0, B: 0 };
  var streak = getStreak();
  var monthsRaw; try { monthsRaw = JSON.parse(localStorage.getItem('octile_months') || '[]'); } catch(e) { monthsRaw = []; }
  var months = []; for (var mi = 0; mi < 12; mi++) { if (monthsRaw[mi]) months.push(mi); }
  var unlocked = getUnlockedAchievements();
  return {
    browser_uuid: getBrowserUUID(),
    level_easy: getLevelProgress('easy'),
    level_medium: getLevelProgress('medium'),
    level_hard: getLevelProgress('hard'),
    level_hell: getLevelProgress('hell'),
    exp: getExp(),
    diamonds: getDiamonds(),
    chapters_completed: getChaptersCompleted(),
    achievements: Object.keys(unlocked),
    streak_count: streak.count || 0,
    streak_last_date: streak.lastDate || null,
    months: months,
    total_solved: parseInt(localStorage.getItem('octile_total_solved') || '0'),
    total_time: parseFloat(localStorage.getItem('octile_total_time') || '0'),
    grades_s: grades.S || 0,
    grades_a: grades.A || 0,
    grades_b: grades.B || 0,
    daily_tasks_date: (function() { try { var d = JSON.parse(localStorage.getItem('octile_daily_tasks') || '{}'); return d.date || null; } catch(e) { return null; } })(),
    daily_tasks_claimed: (function() { try { var d = JSON.parse(localStorage.getItem('octile_daily_tasks') || '{}'); return (d.tasks || []).filter(function(t) { return t.claimed; }).map(function(t) { return t.id; }); } catch(e) { return []; } })(),
    daily_tasks_bonus_claimed: (function() { try { var d = JSON.parse(localStorage.getItem('octile_daily_tasks') || '{}'); return !!d.bonusClaimed; } catch(e) { return false; } })(),
    unlocked_themes: (function() { try { return JSON.parse(localStorage.getItem('octile_unlocked_themes') || '[]'); } catch(e) { return []; } })(),
    solved_set: (function() { try { return JSON.parse(localStorage.getItem('octile_solved') || '[]'); } catch(e) { return []; } })(),
    best_times: (function() { try { var all = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.startsWith('octile_best_')) { all[k.substring(12)] = parseFloat(localStorage.getItem(k)); } } return all; } catch(e) { return {}; } })(),
  };
}

function _applyServerProgress(p) {
  // MAX merge: only update if server value is higher
  var levels = { easy: 'octile_level_easy', medium: 'octile_level_medium', hard: 'octile_level_hard', hell: 'octile_level_hell' };
  for (var lv in levels) {
    var serverVal = p['level_' + lv] || 0;
    if (serverVal > getLevelProgress(lv)) {
      localStorage.setItem(levels[lv], serverVal);
    }
  }
  if ((p.exp || 0) > getExp()) localStorage.setItem('octile_exp', p.exp);
  if ((p.diamonds || 0) > getDiamonds()) localStorage.setItem('octile_diamonds', p.diamonds);
  if ((p.chapters_completed || 0) > getChaptersCompleted()) localStorage.setItem('octile_chapters_completed', p.chapters_completed);
  if ((p.total_solved || 0) > parseInt(localStorage.getItem('octile_total_solved') || '0')) localStorage.setItem('octile_total_solved', p.total_solved);
  if ((p.total_time || 0) > parseFloat(localStorage.getItem('octile_total_time') || '0')) localStorage.setItem('octile_total_time', p.total_time);

  // Grades: MAX per tier
  var grades; try { grades = JSON.parse(localStorage.getItem('octile_grades') || '{}'); } catch(e) { grades = {}; }
  grades.S = Math.max(grades.S || 0, p.grades_s || 0);
  grades.A = Math.max(grades.A || 0, p.grades_a || 0);
  grades.B = Math.max(grades.B || 0, p.grades_b || 0);
  localStorage.setItem('octile_grades', JSON.stringify(grades));

  // Achievements: union
  if (p.achievements && p.achievements.length) {
    var unlocked = getUnlockedAchievements();
    for (var i = 0; i < p.achievements.length; i++) {
      if (!unlocked[p.achievements[i]]) unlocked[p.achievements[i]] = true;
    }
    saveUnlockedAchievements(unlocked);
  }

  // Months: union (server sends clean indices [3,5], local may be sparse [null,null,null,true,...])
  if (p.months && p.months.length) {
    var localMonthsRaw; try { localMonthsRaw = JSON.parse(localStorage.getItem('octile_months') || '[]'); } catch(e) { localMonthsRaw = []; }
    // Convert local sparse array to index set
    for (var mi = 0; mi < 12; mi++) { if (localMonthsRaw[mi]) localMonthsRaw[mi] = true; }
    // Apply server months
    for (var si = 0; si < p.months.length; si++) { var idx = p.months[si]; if (idx >= 0 && idx < 12) localMonthsRaw[idx] = true; }
    localStorage.setItem('octile_months', JSON.stringify(localMonthsRaw));
  }

  // Streak: keep higher or more recent
  var localStreak = getStreak();
  if ((p.streak_count || 0) > (localStreak.count || 0) ||
      ((p.streak_count || 0) === (localStreak.count || 0) && (p.streak_last_date || '') >= (localStreak.lastDate || ''))) {
    localStorage.setItem('octile_streak', JSON.stringify({ count: p.streak_count, lastDate: p.streak_last_date }));
  }

  // Daily tasks: merge claimed from server (if same date, union claimed IDs)
  if (p.daily_tasks_date) {
    try {
      var localTasks = getDailyTasks();
      if (p.daily_tasks_date === localTasks.date && p.daily_tasks_claimed) {
        var serverClaimed = p.daily_tasks_claimed;
        for (var ti = 0; ti < localTasks.tasks.length; ti++) {
          if (serverClaimed.indexOf(localTasks.tasks[ti].id) >= 0) {
            localTasks.tasks[ti].claimed = true;
          }
        }
        if (p.daily_tasks_bonus_claimed) localTasks.bonusClaimed = true;
        localStorage.setItem('octile_daily_tasks', JSON.stringify(localTasks));
        checkDailyTaskNotification();
      }
    } catch(e) {}
  }

  // Unlocked themes: union
  if (p.unlocked_themes && p.unlocked_themes.length) {
    try {
      var local = JSON.parse(localStorage.getItem('octile_unlocked_themes') || '[]');
      var merged = Array.from(new Set(local.concat(p.unlocked_themes)));
      localStorage.setItem('octile_unlocked_themes', JSON.stringify(merged));
    } catch(e) {}
  }

  // Solved set: union
  if (p.solved_set && p.solved_set.length) {
    try {
      var localSolved = JSON.parse(localStorage.getItem('octile_solved') || '[]');
      var mergedSolved = Array.from(new Set(localSolved.concat(p.solved_set)));
      localStorage.setItem('octile_solved', JSON.stringify(mergedSolved));
    } catch(e) {}
  }

  // Best times: per-puzzle MIN (keep faster)
  if (p.best_times) {
    try {
      for (var pid in p.best_times) {
        var key = 'octile_best_' + pid;
        var serverTime = p.best_times[pid];
        var localTime = parseFloat(localStorage.getItem(key) || '999999');
        if (serverTime < localTime) localStorage.setItem(key, serverTime);
      }
    } catch(e) {}
  }

  // Refresh displays
  updateExpDisplay();
  updateDiamondDisplay();
}

async function _pullProgressOnly() {
  if (!isAuthenticated()) return;
  try {
    var res = await fetch(WORKER_URL + '/sync/pull', { headers: getAuthHeaders() });
    if (res.ok) {
      var data = await res.json();
      if (data.status === 'ok' && data.progress) {
        _applyServerProgress(data.progress);
        // Server score totals are authoritative — always reconcile
        if (typeof data.score_exp === 'number') localStorage.setItem('octile_exp', Math.max(data.score_exp, getExp()));
        if (typeof data.score_diamonds === 'number') localStorage.setItem('octile_diamonds', Math.max(data.score_diamonds, getDiamonds()));
        updateExpDisplay();
        updateDiamondDisplay();
      }
    }
    console.log('[Octile] Progress pulled');
  } catch (e) {
    console.warn('[Octile] Pull failed:', e.message);
  }
}

async function syncProgress() {
  if (!isAuthenticated()) return;
  var headers = getAuthHeaders();
  headers['Content-Type'] = 'application/json';
  try {
    // Push local → server
    await fetch(WORKER_URL + '/sync/push', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(_getLocalProgress()),
    });
    // Pull server → local
    var res = await fetch(WORKER_URL + '/sync/pull', { headers: getAuthHeaders() });
    if (res.ok) {
      var data = await res.json();
      if (data.status === 'ok' && data.progress) {
        _applyServerProgress(data.progress);
        // Server score totals are authoritative — always reconcile
        if (typeof data.score_exp === 'number') localStorage.setItem('octile_exp', Math.max(data.score_exp, getExp()));
        if (typeof data.score_diamonds === 'number') localStorage.setItem('octile_diamonds', Math.max(data.score_diamonds, getDiamonds()));
        updateExpDisplay();
        updateDiamondDisplay();
      }
    }
    console.log('[Octile] Progress synced');
  } catch (e) {
    console.warn('[Octile] Sync failed:', e.message);
  }
}

// --- Player Profile ---

// ELO-based rank tiers (used when server ELO is available)
var ELO_RANK_TIERS = [
  { min: 2800, en: 'Grandmaster', zh: '\u5B97\u5E2B' },
  { min: 2400, en: 'Master', zh: '\u5927\u5E2B' },
  { min: 2000, en: 'Expert', zh: '\u5C08\u5BB6' },
  { min: 1600, en: 'Strategist', zh: '\u7B56\u7565\u5BB6' },
  { min: 1200, en: 'Puzzler', zh: '\u89E3\u8B0E\u8005' },
  { min: 800,  en: 'Apprentice', zh: '\u898B\u7FD2\u751F' },
  { min: 0,    en: 'Novice', zh: '\u521D\u5B78\u8005' }
];

// EXP-based rank tiers (fallback when offline)
var EXP_RANK_TIERS = [
  { min: 500000, en: 'Grandmaster', zh: '\u5B97\u5E2B' },
  { min: 150000, en: 'Master', zh: '\u5927\u5E2B' },
  { min: 50000,  en: 'Expert', zh: '\u5C08\u5BB6' },
  { min: 15000,  en: 'Strategist', zh: '\u7B56\u7565\u5BB6' },
  { min: 5000,   en: 'Puzzler', zh: '\u89E3\u8B0E\u8005' },
  { min: 1000,   en: 'Apprentice', zh: '\u898B\u7FD2\u751F' },
  { min: 0,      en: 'Novice', zh: '\u521D\u5B78\u8005' }
];

function _getRankFromTiers(value, tiers) {
  for (var i = 0; i < tiers.length; i++) {
    if (value >= tiers[i].min) return tiers[i][currentLang] || tiers[i].en;
  }
  return tiers[tiers.length - 1][currentLang] || 'Novice';
}

function getRankTitle(exp) { return _getRankFromTiers(exp, EXP_RANK_TIERS); }
function getEloRankTitle(elo) { return _getRankFromTiers(elo, ELO_RANK_TIERS); }

// Player tier for progressive disclosure (new / active / expert)
function getPlayerTier() {
  var totalSolved = parseInt(localStorage.getItem('octile_total_solved') || '0');
  var streak = getStreak().count || 0;
  if (totalSolved > TIER_EXPERT || streak >= TIER_EXPERT_STREAK) return 'expert';
  if (totalSolved >= TIER_ACTIVE) return 'active';
  return 'new';
}

function getRankColor(exp) {
  if (exp >= 500000) return '#f1c40f';
  if (exp >= 150000) return '#e74c3c';
  if (exp >= 50000) return '#9b59b6';
  if (exp >= 15000) return '#e67e22';
  if (exp >= 5000) return '#3498db';
  if (exp >= 1000) return '#2ecc71';
  return '#888';
}

function getEloRankColor(elo) {
  if (elo >= 2800) return '#f1c40f';
  if (elo >= 2400) return '#e74c3c';
  if (elo >= 2000) return '#9b59b6';
  if (elo >= 1600) return '#e67e22';
  if (elo >= 1200) return '#3498db';
  if (elo >= 800) return '#2ecc71';
  return '#888';
}

function getNextRankExp(exp) {
  for (var i = EXP_RANK_TIERS.length - 1; i >= 0; i--) {
    if (EXP_RANK_TIERS[i].min > exp) return EXP_RANK_TIERS[i].min;
  }
  return null;
}

function calcProfileStats() {
  var totalSolves = parseInt(localStorage.getItem('octile_total_solved') || '0');
  var totalTime = parseFloat(localStorage.getItem('octile_total_time') || '0');
  var avgTime = totalSolves > 0 ? totalTime / totalSolves : 0;
  var exp = getExp();
  var grades; try { grades = JSON.parse(localStorage.getItem('octile_grades') || '{}'); } catch(e) { grades = {}; }
  if (!grades.S) grades = { S: 0, A: 0, B: 0 };
  var gradeTotal = grades.S + grades.A + grades.B;

  // Per-world progress
  var worldSolves = {};
  var totalProgress = 0;
  var totalPuzzles = 0;
  for (var i = 0; i < LEVELS.length; i++) {
    var lv = LEVELS[i];
    var prog = getLevelProgress(lv);
    var tot = getEffectiveLevelTotal(lv);
    worldSolves[lv] = prog;
    totalProgress += prog;
    totalPuzzles += tot;
  }

  // Speed: avg par / avg time (weighted by world distribution)
  var weightedPar = 0;
  if (totalProgress > 0) {
    for (var j = 0; j < LEVELS.length; j++) {
      var lvl = LEVELS[j];
      var w = worldSolves[lvl] / totalProgress;
      weightedPar += (PAR_TIMES[lvl] || 90) * w;
    }
  } else {
    weightedPar = 90;
  }
  var speed = avgTime > 0 ? Math.min(100, Math.round(weightedPar / avgTime * 100)) : 0;

  // Mastery: S-grade rate (% of S grades)
  var mastery = gradeTotal > 0 ? Math.round(grades.S / gradeTotal * 100) : 0;

  // Breadth: worlds with progress, weighted by depth
  var worldsPlayed = 0;
  var breadthScore = 0;
  for (var k = 0; k < LEVELS.length; k++) {
    var lk = LEVELS[k];
    var pk = getEffectiveLevelTotal(lk);
    if (worldSolves[lk] > 0) {
      worldsPlayed++;
      breadthScore += Math.min(1, worldSolves[lk] / Math.max(1, pk) * 4);
    }
  }
  var breadth = Math.round(breadthScore / 4 * 100);

  // Dedication: streak + months
  var streak = getStreak().count || 0;
  var months; try { months = JSON.parse(localStorage.getItem('octile_months') || '[]'); } catch(e) { months = []; }
  var dedication = Math.min(100, Math.round(streak * 2.5 + months.length * 6));

  // Progress: log scale so early progress feels meaningful
  var progress = totalProgress > 0 ? Math.min(100, Math.round(Math.log10(totalProgress + 1) / Math.log10(totalPuzzles + 1) * 100)) : 0;

  return {
    exp: exp, diamonds: getDiamonds(), totalSolves: totalSolves, avgTime: avgTime,
    grades: grades, gradeTotal: gradeTotal,
    worldSolves: worldSolves, totalProgress: totalProgress, totalPuzzles: totalPuzzles,
    streak: streak, months: months,
    achieveCount: Object.keys(getUnlockedAchievements()).length,
    achieveTotal: ACHIEVEMENTS.length,
    radar: { speed: speed, mastery: mastery, breadth: breadth, dedication: dedication, progress: progress }
  };
}

function renderRadarSVG(values) {
  var axes = [
    { key: 'speed', label: t('profile_speed') },
    { key: 'mastery', label: t('profile_mastery') },
    { key: 'breadth', label: t('profile_breadth') },
    { key: 'dedication', label: t('profile_dedication') },
    { key: 'progress', label: t('profile_progress') }
  ];
  var n = axes.length;
  var cx = 120, cy = 120, R = 90;
  var angleOff = -Math.PI / 2;

  function polar(i, r) {
    var a = angleOff + (2 * Math.PI * i / n);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  var svg = '<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">';

  // Grid rings
  for (var ring = 1; ring <= 4; ring++) {
    var r = R * ring / 4;
    var pts = [];
    for (var gi = 0; gi < n; gi++) pts.push(polar(gi, r).join(','));
    svg += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>';
  }

  // Axis lines
  for (var ai = 0; ai < n; ai++) {
    var ep = polar(ai, R);
    svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ep[0] + '" y2="' + ep[1] + '" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>';
  }

  // Data polygon
  var dataPts = [];
  for (var di = 0; di < n; di++) {
    var val = values[axes[di].key] || 0;
    dataPts.push(polar(di, R * val / 100).join(','));
  }
  svg += '<polygon points="' + dataPts.join(' ') + '" fill="rgba(46,204,113,0.2)" stroke="#2ecc71" stroke-width="2"/>';

  // Data dots + labels
  for (var li = 0; li < n; li++) {
    var v = values[axes[li].key] || 0;
    var dp = polar(li, R * v / 100);
    svg += '<circle cx="' + dp[0] + '" cy="' + dp[1] + '" r="3" fill="#2ecc71"/>';

    // Label outside
    var lp = polar(li, R + 22);
    svg += '<text x="' + lp[0] + '" y="' + lp[1] + '" class="profile-radar-labels">' + axes[li].label + '</text>';

    // Value
    var vp = polar(li, R + 12);
    svg += '<text x="' + vp[0] + '" y="' + (vp[1] + 10) + '" class="profile-radar-value">' + v + '</text>';
  }

  svg += '</svg>';
  return svg;
}

function showProfileModal() {
  _maybeShowSignInHint();
  _configReady.then(function() { _showProfileModalInner(); });
}
function _showProfileModalInner() {
  var stats = calcProfileStats();
  var exp = stats.exp;
  var uuid = getBrowserUUID();
  var authUser = getAuthUser();
  var name = authUser ? authUser.display_name : generateCuteName(uuid);

  // Render immediately with local data, then enhance with server data
  _renderProfileCard(stats, uuid, name, authUser, null);
  document.getElementById('profile-modal').classList.add('show');

  // Fetch server stats (ELO + authoritative grades) in background
  if (isOnline()) {
    fetch(WORKER_URL + '/player/' + uuid + '/stats', { signal: AbortSignal.timeout(5000) })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data && data.status === 'ok') {
          _renderProfileCard(stats, uuid, name, authUser, data);
        }
      })
      .catch(function() {});
  }
}

function _renderProfileCard(stats, uuid, name, authUser, serverStats) {
  var html = '<h2>' + t('profile_title') + '</h2>';

  // --- Electron D1: minimal profile (name + avatar + world progress) ---
  if (!_feature('elo_profile')) {
    html += '<div class="profile-header" style="display:flex;flex-direction:column;align-items:center">';
    html += '<div class="profile-avatar">' + sbAvatarHTML(uuid, 56, null) + '</div>';
    html += '<div class="profile-name">' + name + '</div>';
    html += '</div>';

    // World progress bars (all difficulties)
    html += '<div class="profile-worlds">';
    html += '<div class="profile-worlds-title">' + t('profile_difficulty') + '</div>';
    for (var ei = 0; ei < LEVELS.length; ei++) {
      var elv = LEVELS[ei];
      var etotal = getEffectiveLevelTotal(elv);
      var edone = stats.worldSolves[elv] || 0;
      var epct = etotal > 0 ? (edone / etotal * 100) : 0;
      var etheme = WORLD_THEMES[elv];
      var ecolor = LEVEL_COLORS[elv];
      html += '<div class="profile-world-row">';
      html += '<span class="profile-world-icon">' + etheme.icon + '</span>';
      html += '<span class="profile-world-name">' + t('level_' + elv) + '</span>';
      html += '<span class="profile-world-bar"><span class="profile-world-fill" style="width:' + epct.toFixed(1) + '%;background:' + ecolor + '"></span></span>';
      if (edone === 0) {
        html += '<span class="profile-world-pct profile-world-empty">' + t('profile_world_not_tried') + '</span>';
      } else {
        html += '<span class="profile-world-pct">' + epct.toFixed(1) + '%</span>';
      }
      html += '</div>';
    }
    html += '</div>';

    document.getElementById('profile-body').innerHTML = html;
    return;
  }

  // --- Non-Electron: full profile ---
  var exp = stats.exp;
  var elo = serverStats ? serverStats.elo : null;
  var rankTitle = elo ? getEloRankTitle(elo) : getRankTitle(exp);
  var rankColor = elo ? getEloRankColor(elo) : getRankColor(exp);
  var nextRank = elo ? null : getNextRankExp(exp);
  var tier = getPlayerTier();

  // Use server grade distribution if available, else local
  var grades = stats.grades;
  var gradeTotal = stats.gradeTotal;
  if (serverStats && serverStats.grade_distribution) {
    grades = serverStats.grade_distribution;
    gradeTotal = (grades.S || 0) + (grades.A || 0) + (grades.B || 0);
  }

  // Auth row (signed-out: sign-in prompt; signed-in: Account & Data section at bottom)
  if (isAuthEnabled() && !authUser) {
    html += '<div class="profile-auth-row">';
    html += '<div class="profile-auth-info">' + t('auth_save_prompt_detail') + '</div>';
    html += '<button class="profile-signin-btn" onclick="document.getElementById(\'profile-modal\').classList.remove(\'show\');showAuthModal()">' + t('auth_signin') + '</button>';
    html += '</div>';
  }

  // Header
  html += '<div class="profile-header">';
  html += '<div class="profile-avatar">' + sbAvatarHTML(uuid, 56, authUser ? authUser.picture : null) + '</div>';
  html += '<div class="profile-name">' + name + '</div>';
  var _leagueTier = parseInt(localStorage.getItem('octile_league_tier') || '-1');
  if (_leagueTier >= 0 && LEAGUE_TIERS_CLIENT[_leagueTier]) {
    html += '<div style="text-align:center;margin:4px 0;font-size:14px">' + LEAGUE_TIERS_CLIENT[_leagueTier].icon + ' ' + t('league_tier_' + _leagueTier) + '</div>';
  }
  html += '<div class="profile-rank"><span class="profile-rank-title" style="color:' + rankColor + '">' + rankTitle + '</span></div>';
  html += '<div class="profile-exp-row">';
  if (elo) {
    html += t('profile_elo') + ' ' + Math.round(elo) + ' \u00B7 ';
  }
  html += '\u2B50 ' + exp.toLocaleString() + ' EXP';
  if (nextRank) html += ' \u00B7 ' + t('profile_next_rank').replace('{exp}', nextRank.toLocaleString());
  html += '</div>';
  html += '</div>';

  // --- New player: simplified view ---
  if (tier === 'new') {
    // Quick stats instead of radar
    html += '<div class="profile-new-summary">';
    html += '<div class="profile-new-stat">' + stats.totalSolves + ' ' + t('profile_new_solved') + '</div>';
    if (stats.streak > 0) html += '<div class="profile-new-stat">\uD83D\uDD25 ' + stats.streak + ' ' + t('profile_streak') + '</div>';
    html += '</div>';

    // CTA: continue playing
    html += '<div class="profile-new-cta">';
    html += '<button class="profile-cta-btn" onclick="document.getElementById(\'profile-modal\').classList.remove(\'show\');returnToWelcome()">\u25B6 ' + t('profile_continue') + '</button>';
    html += '</div>';

    // Minimal world progress (only worlds with progress)
    var hasAnyProgress = false;
    for (var ni = 0; ni < LEVELS.length; ni++) {
      if (stats.worldSolves[LEVELS[ni]] > 0) { hasAnyProgress = true; break; }
    }
    if (hasAnyProgress) {
      html += '<div class="profile-worlds">';
      html += '<div class="profile-worlds-title">' + t('profile_difficulty') + '</div>';
      for (var nj = 0; nj < LEVELS.length; nj++) {
        var nlv = LEVELS[nj];
        var ndone = stats.worldSolves[nlv] || 0;
        if (ndone === 0) continue;
        var ntotal = getEffectiveLevelTotal(nlv);
        var npct = ntotal > 0 ? (ndone / ntotal * 100) : 0;
        var ntheme = WORLD_THEMES[nlv];
        var ncolor = LEVEL_COLORS[nlv];
        html += '<div class="profile-world-row">';
        html += '<span class="profile-world-icon">' + ntheme.icon + '</span>';
        html += '<span class="profile-world-name">' + t('level_' + nlv) + '</span>';
        html += '<span class="profile-world-bar"><span class="profile-world-fill" style="width:' + npct.toFixed(1) + '%;background:' + ncolor + '"></span></span>';
        html += '<span class="profile-world-pct">' + npct.toFixed(1) + '%</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    // Footer: just diamonds
    html += '<div class="profile-footer">';
    html += '<div class="profile-footer-item"><div class="profile-footer-val">\uD83D\uDC8E ' + stats.diamonds.toLocaleString() + '</div><div class="profile-footer-label">' + t('profile_diamonds') + '</div></div>';
    html += '</div>';

    html += _renderAccountSection(authUser);
    document.getElementById('profile-body').innerHTML = html;
    return;
  }

  // --- Active & Expert: full view ---

  // Radar chart (gated by elo_profile feature flag)
  if (_feature('elo_profile')) {
    var radarTotal = stats.radar.speed + stats.radar.mastery + stats.radar.breadth + stats.radar.dedication + stats.radar.progress;
    if (radarTotal > 0) {
      html += '<div class="profile-radar">' + renderRadarSVG(stats.radar) + '</div>';
    } else {
      html += '<div class="profile-radar-empty">';
      html += '<div class="profile-radar-empty-icon">\uD83D\uDCCA</div>';
      html += t('profile_radar_empty');
      html += '</div>';
    }
  }

  // Grade distribution (gated by elo_profile feature flag)
  if (_feature('elo_profile') && gradeTotal > 0) {
    var sPct = Math.round((grades.S || 0) / gradeTotal * 100);
    var aPct = Math.round((grades.A || 0) / gradeTotal * 100);
    var bPct = 100 - sPct - aPct;
    html += '<div style="display:flex;gap:12px;justify-content:center;margin-bottom:14px;font-size:12px">';
    html += '<span style="color:#f1c40f">S ' + sPct + '%</span>';
    html += '<span style="color:#2ecc71">A ' + aPct + '%</span>';
    html += '<span style="color:#3498db">B ' + bPct + '%</span>';
    html += '</div>';
  }

  // World progress
  html += '<div class="profile-worlds">';
  html += '<div class="profile-worlds-title">' + t('profile_difficulty') + '</div>';
  for (var i = 0; i < LEVELS.length; i++) {
    var lv = LEVELS[i];
    var total = getEffectiveLevelTotal(lv);
    var done = stats.worldSolves[lv] || 0;
    var pct = total > 0 ? (done / total * 100) : 0;
    var theme = WORLD_THEMES[lv];
    var color = LEVEL_COLORS[lv];
    html += '<div class="profile-world-row">';
    html += '<span class="profile-world-icon">' + theme.icon + '</span>';
    html += '<span class="profile-world-name">' + t('level_' + lv) + '</span>';
    html += '<span class="profile-world-bar"><span class="profile-world-fill" style="width:' + pct.toFixed(1) + '%;background:' + color + '"></span></span>';
    if (done === 0) {
      html += '<span class="profile-world-pct profile-world-empty">' + t('profile_world_not_tried') + '</span>';
    } else {
      html += '<span class="profile-world-pct">' + pct.toFixed(1) + '%</span>';
    }
    html += '</div>';
  }
  html += '</div>';

  // Footer stats
  html += '<div class="profile-footer">';
  html += '<div class="profile-footer-item"><div class="profile-footer-val">\uD83D\uDD25 ' + stats.streak + '</div><div class="profile-footer-label">' + t('profile_streak') + '</div></div>';
  html += '<div class="profile-footer-item"><div class="profile-footer-val">\uD83D\uDC8E ' + stats.diamonds.toLocaleString() + '</div><div class="profile-footer-label">' + t('profile_diamonds') + '</div></div>';
  html += '<div class="profile-footer-item"><div class="profile-footer-val">\uD83C\uDFC6 ' + stats.achieveCount + '/' + stats.achieveTotal + '</div><div class="profile-footer-label">' + t('profile_achievements') + '</div></div>';
  html += '</div>';

  // --- Expert: advanced stats (collapsed) ---
  if (tier === 'expert') {
    var sRate = gradeTotal > 0 ? Math.round((grades.S || 0) / gradeTotal * 100) : 0;
    var aRate = gradeTotal > 0 ? Math.round(((grades.S || 0) + (grades.A || 0)) / gradeTotal * 100) : 0;
    html += '<details class="profile-advanced">';
    html += '<summary>' + t('profile_advanced') + '</summary>';
    html += '<div class="profile-advanced-grid">';
    html += '<div class="profile-adv-item"><div class="profile-adv-val">' + sRate + '%</div><div class="profile-adv-label">' + t('profile_s_rate') + '</div></div>';
    html += '<div class="profile-adv-item"><div class="profile-adv-val">' + aRate + '%</div><div class="profile-adv-label">' + t('profile_a_rate') + '</div></div>';
    html += '<div class="profile-adv-item"><div class="profile-adv-val">' + (stats.avgTime > 0 ? sbFormatTime(stats.avgTime) : '-') + '</div><div class="profile-adv-label">' + t('sb_stat_avg') + '</div></div>';
    html += '<div class="profile-adv-item"><div class="profile-adv-val">' + stats.totalSolves + '</div><div class="profile-adv-label">' + t('sb_stat_total') + '</div></div>';
    // Difficulty distribution
    var _totalDone = stats.totalProgress || 1;
    for (var ei = 0; ei < LEVELS.length; ei++) {
      var elv = LEVELS[ei];
      var eDone = stats.worldSolves[elv] || 0;
      var eDist = Math.round(eDone / _totalDone * 100);
      html += '<div class="profile-adv-item"><div class="profile-adv-val">' + eDist + '%</div><div class="profile-adv-label">' + t('level_' + elv) + '</div></div>';
    }
    html += '</div></details>';
  }

  html += _renderAccountSection(authUser);
  document.getElementById('profile-body').innerHTML = html;
}

function _renderAccountSection(authUser) {
  if (!isAuthEnabled() || !authUser) return '';
  var h = '<div class="profile-account-section">';
  h += '<div class="profile-account-heading">' + t('account_data') + '</div>';
  var _acctId = authUser.email || authUser.display_name || '';
  if (_acctId) {
    h += '<div class="profile-account-label">' + t('signed_in_as') + '</div>';
    h += '<div class="profile-account-email">' + _acctId + '</div>';
  }
  h += '<button class="profile-logout-btn" onclick="confirmLogout()">' + t('auth_signout') + '</button>';
  h += '<div class="profile-logout-helper">' + t('logout_helper') + '</div>';
  h += '<div class="profile-account-divider"></div>';
  h += '<div class="profile-danger-zone">' + t('danger_zone') + '</div>';
  h += '<a class="profile-delete-link" href="#" onclick="_checkOnlineThenStepA();return false">' + t('delete_account') + '</a>';
  h += '<div class="profile-delete-helper">' + t('delete_account_helper') + '</div>';
  h += '</div>';
  return h;
}

function confirmLogout() {
  var body = document.getElementById('profile-body');
  var h = '<div class="logout-confirm-page">';
  h += '<h2>' + t('logout_confirm_title') + '</h2>';
  h += '<div class="logout-confirm-body">' + t('logout_confirm_body') + '</div>';
  h += '<div class="delete-account-actions">';
  h += '<button class="delete-cancel-btn" onclick="showProfileModal()">' + t('cancel') + '</button>';
  h += '<button class="delete-danger-btn" onclick="authLogout();showProfileModal()">' + t('auth_signout') + '</button>';
  h += '</div>';
  h += '</div>';
  body.innerHTML = h;
}

function showDeleteAccountStepA() {
  var body = document.getElementById('profile-body');
  var h = '<div class="delete-account-page">';
  h += '<h2>' + t('delete_account') + '</h2>';
  h += '<ul class="delete-account-bullets">';
  h += '<li>' + t('delete_account_bullet_1') + '</li>';
  h += '<li>' + t('delete_account_bullet_2') + '</li>';
  h += '<li>' + t('delete_account_bullet_3') + '</li>';
  h += '</ul>';
  h += '<div class="delete-account-warning">' + t('delete_account_irreversible') + '</div>';
  h += '<div class="delete-account-hint">' + t('delete_account_hint_pre') + '<a href="#" onclick="confirmLogout();return false">' + t('delete_account_hint_link') + '</a>' + t('delete_account_hint_post') + '</div>';
  h += '<div class="delete-account-actions">';
  h += '<button class="delete-cancel-btn" onclick="showProfileModal()">' + t('cancel') + '</button>';
  h += '<button class="delete-danger-btn" onclick="_checkOnlineThenDelete(this)">' + t('delete_account_btn') + '</button>';
  h += '</div>';
  h += '</div>';
  body.innerHTML = h;
}

function showDeleteAccountStepB() {
  var body = document.getElementById('profile-body');
  var h = '<div class="delete-account-page">';
  h += '<h2>' + t('delete_account_confirm_title') + '</h2>';
  h += '<div class="delete-account-confirm-body">' + t('delete_account_confirm_body') + '</div>';
  h += '<div class="delete-account-confirm-prompt">' + t('delete_account_confirm_prompt') + '</div>';
  h += '<div class="delete-account-actions">';
  h += '<button class="delete-cancel-btn" id="delete-cancel-btn" onclick="showProfileModal()">' + t('cancel') + '</button>';
  h += '<button class="delete-danger-btn" id="delete-confirm-btn" onclick="executeDeleteAccount()">' + t('delete_account_confirm_btn') + '</button>';
  h += '</div>';
  h += '</div>';
  body.innerHTML = h;
}

function executeDeleteAccount() {
  var cancelBtn = document.getElementById('delete-cancel-btn');
  var confirmBtn = document.getElementById('delete-confirm-btn');
  if (cancelBtn) cancelBtn.disabled = true;
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '...'; }

  fetch(WORKER_URL + '/auth/account', {
    method: 'DELETE',
    headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
    credentials: 'include'
  })
  .then(function(r) {
    if (r.ok || r.status === 404) {
      // Success or already deleted — clean up locally
      authLogout();
      document.getElementById('profile-modal').classList.remove('show');
      returnToWelcome();
      var toast = document.getElementById('encourage-toast');
      if (toast) {
        toast.textContent = t('delete_account_success');
        toast.classList.add('show');
        setTimeout(function() { toast.classList.remove('show'); }, 3000);
      }
    } else if (r.status === 401) {
      _showDeleteError(t('delete_account_reauth'), false);
    } else {
      _showDeleteError(t('delete_account_error'), true);
    }
  })
  .catch(function() {
    _showDeleteError(t('delete_account_offline'), true);
  });
}

function _checkOnlineThenStepA() {
  fetch(WORKER_URL + '/auth/me', { method: 'GET', headers: getAuthHeaders(), credentials: 'include' })
    .then(function() { showDeleteAccountStepA(); })
    .catch(function() { _showDeleteError(t('delete_account_offline'), true); });
}

function _checkOnlineThenDelete(btn) {
  btn.disabled = true;
  btn.textContent = '...';
  fetch(WORKER_URL + '/auth/me', { method: 'GET', headers: getAuthHeaders(), credentials: 'include' })
    .then(function() { showDeleteAccountStepB(); })
    .catch(function() { _showDeleteError(t('delete_account_offline'), true); });
}

function _showDeleteError(msg, showRetry) {
  var body = document.getElementById('profile-body');
  var h = '<div class="delete-account-page">';
  h += '<h2>' + t('delete_account') + '</h2>';
  h += '<div class="delete-error-msg">' + msg + '</div>';
  h += '<div class="delete-account-actions">';
  if (showRetry) {
    h += '<button class="delete-cancel-btn" onclick="showProfileModal()">' + t('cancel') + '</button>';
    h += '<button class="delete-danger-btn" onclick="executeDeleteAccount()">' + t('retry') + '</button>';
  } else {
    h += '<button class="delete-cancel-btn" onclick="showProfileModal()">' + t('cancel') + '</button>';
  }
  h += '</div>';
  h += '</div>';
  body.innerHTML = h;
}

// --- Event listeners (replaces inline onclick) ---

// Header buttons
document.getElementById('menu-btn').addEventListener('click', returnToWelcome);
document.getElementById('pause-btn').addEventListener('click', pauseGame);
document.getElementById('pause-play-btn').addEventListener('click', resumeGame);
document.getElementById('pause-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) resumeGame();
});

// Auto-pause on visibility change (tab hidden, app backgrounded)
// Track energy when leaving, show recovery toast on return
let _energyOnHide = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    _stopHealthPoll();
    _energyOnHide = _feature('energy') ? Math.floor(getEnergyState().points) : 0;
    if (timerStarted && !gameOver && !paused) {
      pauseGame();
    }
  } else {
    _startHealthPoll();
    // Flow 5: returning to app — check if energy recovered
    if (_feature('energy')) {
      const nowPlays = Math.floor(getEnergyState().points);
      if (nowPlays > _energyOnHide && _energyOnHide <= 0) {
        // Was at zero, now has plays — show recovery toast
        const toast = document.getElementById('achieve-toast');
        toast.querySelector('.toast-icon').textContent = '\u2615';
        toast.querySelector('.toast-label').textContent = '';
        toast.querySelector('.toast-name').textContent = t('energy_ready');
        toast.classList.add('show');
        if (achieveToastTimer) clearTimeout(achieveToastTimer);
        achieveToastTimer = setTimeout(() => { toast.classList.remove('show'); achieveToastTimer = null; }, 4000);
      }
      updateEnergyDisplay();
    }
    updateExpDisplay();
    updateDiamondDisplay();
  }
});

function closeSettingsAndDo(fn) {
  _closeSettings();
  setTimeout(fn, 350);
}
document.getElementById('help-btn').addEventListener('click', () => closeSettingsAndDo(() => document.getElementById('help-modal').classList.add('show')));
document.getElementById('goals-btn').addEventListener('click', () => closeSettingsAndDo(() => showGoalsModal()));
document.getElementById('messages-btn').addEventListener('click', () => closeSettingsAndDo(showMessagesModal));

// Settings modal
const THEMES = [
  { id: 'default', key: 'theme_classic', cost: 0 },
  { id: 'lego', key: 'theme_lego', cost: 0 },
  { id: 'wood', key: 'theme_wood', cost: 0 },
  { id: 'stained-glass', key: 'theme_stained_glass', cost: 500 },
  { id: 'marble-gold', key: 'theme_marble_gold', cost: 800 },
  { id: 'quilt', key: 'theme_quilt', cost: 500 },
  { id: 'deep-sea', key: 'theme_deep_sea', cost: 1000 },
  { id: 'space-galaxy', key: 'theme_space_galaxy', cost: 1500 },
  { id: 'botanical', key: 'theme_botanical', cost: 500 },
  { id: 'cyberpunk', key: 'theme_cyberpunk', cost: 1000 },
  { id: 'ancient-ink', key: 'theme_ancient_ink', cost: 800 },
  { id: 'ukiyo-e', key: 'theme_ukiyo_e', cost: 1000 },
  { id: 'steampunk', key: 'theme_steampunk', cost: 1500 },
  { id: 'frozen', key: 'theme_frozen', cost: 800 },
  { id: 'halloween', key: 'theme_halloween', cost: 800 },
];
function getThemeCost(th) { return _cfg('themeCosts.' + th.id, th.cost); }
const THEME_SWATCHES = {
  'default':       ['#1a1a40','#e74c3c','#3498db','#f1c40f','#ecf0f1','#888','#16213e','#e74c3c','#3498db'],
  'lego':          ['#2d8a4e','#c0392b','#2980b9','#f39c12','#ecf0f1','#7f8c8d','#1a5c2a','#c0392b','#2980b9'],
  'wood':          ['#6b4226','#a63c2e','#2b5e7e','#c49a2a','#d4c5a9','#8b7355','#5c3a1e','#a63c2e','#2b5e7e'],
  'stained-glass': ['#18082a','#b83230','#1e6898','#c8a010','#a8b8c0','#7a6830','#2a1a3a','#b83230','#1e6898'],
  'marble-gold':   ['#ece4d6','#d8c8a8','#c0aa80','#dcc888','#f0ebe0','#b0a090','#c8b898','#d8c8a8','#c0aa80'],
  'quilt':         ['#f0e0cc','#c85040','#4a7c6f','#d8a848','#ecdcc8','#a89080','#6a5040','#c85040','#4a7c6f'],
  'deep-sea':      ['#081420','#186878','#0c4468','#188878','#50c8b8','#1e3a48','#051018','#186878','#0c4468'],
  'space-galaxy':  ['#08041a','#6828a0','#220e50','#8838b8','#b858d8','#3a1860','#08041a','#6828a0','#220e50'],
  'botanical':     ['#1a2e1a','#488838','#2a6228','#70b050','#98d080','#4a6840','#142014','#488838','#2a6228'],
  'cyberpunk':     ['#0a0a16','#ff2a6d','#05d9e8','#c8f0ff','#ff6898','#282838','#0a0a16','#ff2a6d','#05d9e8'],
  'ancient-ink':   ['#efe6d4','#282420','#484440','#b83020','#d8d0c0','#888078','#d4cab8','#282420','#484440'],
  'ukiyo-e':       ['#281a10','#b83828','#285878','#c89838','#dcc898','#5a4030','#281a10','#b83828','#285878'],
  'steampunk':     ['#18100a','#8a6830','#604820','#a88038','#c0a060','#4a3a28','#1a1008','#8a6830','#604820'],
  'frozen':        ['#e4ecf4','#88c0e0','#5898c8','#a8d0e8','#f0f6fc','#98b0c4','#a8c0d8','#88c0e0','#5898c8'],
  'halloween':     ['#18081a','#d85820','#7028a0','#d89818','#e8b848','#3a1a3a','#180a18','#d85820','#7028a0'],
};
function getUnlockedThemes() {
  try { return JSON.parse(localStorage.getItem('octile_unlocked_themes') || '[]'); } catch(e) { return []; }
}
function isThemeUnlocked(id) {
  var th = THEMES.find(t => t.id === id);
  if (!th || getThemeCost(th) === 0) return true;
  return getUnlockedThemes().indexOf(id) >= 0;
}
function unlockTheme(id) {
  var list = getUnlockedThemes();
  if (list.indexOf(id) < 0) { list.push(id); localStorage.setItem('octile_unlocked_themes', JSON.stringify(list)); }
}
const ALL_THEME_CLASSES = THEMES.filter(t => t.id !== 'default').map(t => t.id + '-theme');
function getCurrentTheme() {
  for (var i = 0; i < THEMES.length; i++) {
    if (THEMES[i].id !== 'default' && document.body.classList.contains(THEMES[i].id + '-theme')) return THEMES[i].id;
  }
  return 'default';
}
function setTheme(theme) {
  ALL_THEME_CLASSES.forEach(c => document.body.classList.remove(c));
  if (theme !== 'default') document.body.classList.add(theme + '-theme');
  try { localStorage.setItem('octile-theme', theme); } catch(e) {}
}
var _themeScrollIdx = 0;
function _themeVisibleCount() {
  var scroll = document.getElementById('theme-scroll');
  if (!scroll) return 3;
  return Math.max(1, Math.floor(scroll.clientWidth / 84));
}
function _updateThemeScroll() {
  var grid = document.getElementById('theme-grid');
  var leftBtn = document.getElementById('theme-left');
  var rightBtn = document.getElementById('theme-right');
  if (!grid) return;
  var vis = _themeVisibleCount();
  var _themeCount = !_feature('paid_themes') ? THEMES.filter(function(th) { return getThemeCost(th) === 0; }).length : THEMES.length;
  var maxIdx = Math.max(0, _themeCount - vis);
  _themeScrollIdx = Math.max(0, Math.min(_themeScrollIdx, maxIdx));
  grid.style.transform = 'translateX(' + (-_themeScrollIdx * 84) + 'px)';
  if (leftBtn) leftBtn.disabled = _themeScrollIdx <= 0;
  if (rightBtn) rightBtn.disabled = _themeScrollIdx >= maxIdx;
}
function renderThemeGrid() {
  var grid = document.getElementById('theme-grid');
  if (!grid) return;
  var cur = getCurrentTheme();
  // Electron D1: only free themes (no paid themes, no lock icons, no purchase flow)
  var visibleThemes = !_feature('paid_themes') ? THEMES.filter(function(th) { return getThemeCost(th) === 0; }) : THEMES;
  var html = '';
  visibleThemes.forEach(th => {
    var unlocked = isThemeUnlocked(th.id);
    var active = th.id === cur;
    var cls = 'theme-tile' + (active ? ' active' : '') + (!unlocked ? ' locked' : '');
    var swatch = THEME_SWATCHES[th.id] || THEME_SWATCHES['default'];
    html += '<div class="' + cls + '" data-theme="' + th.id + '">';
    if (active) html += '<span class="theme-check">\u2714</span>';
    html += '<div class="theme-swatch">';
    for (var s = 0; s < 9; s++) html += '<span style="background:' + swatch[s] + '"></span>';
    html += '</div>';
    html += '<div class="theme-name">' + t(th.key) + '</div>';
    if (!unlocked && _feature('paid_themes')) html += '<div class="theme-lock">' + t('theme_locked').replace('{cost}', getThemeCost(th)) + '</div>';
    html += '</div>';
  });
  grid.innerHTML = html;
  // Scroll to active theme on first render
  var activeIdx = THEMES.findIndex(th => th.id === cur);
  if (activeIdx >= 0) {
    var vis = _themeVisibleCount();
    _themeScrollIdx = Math.max(0, activeIdx - Math.floor(vis / 2));
  }
  _updateThemeScroll();
  grid.querySelectorAll('.theme-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      var id = tile.dataset.theme;
      if (!isThemeUnlocked(id)) {
        var th = THEMES.find(t => t.id === id);
        document.getElementById('settings-modal').classList.remove('show');
        showDiamondPurchase(t(th.key), getThemeCost(th), () => {
          unlockTheme(id);
          setTheme(id);
          document.getElementById('settings-modal').classList.add('show');
          renderThemeGrid();
        });
        return;
      }
      setTheme(id);
      renderThemeGrid();
    });
  });
}
document.getElementById('theme-left').addEventListener('click', () => { _themeScrollIdx--; _updateThemeScroll(); });
document.getElementById('theme-right').addEventListener('click', () => { _themeScrollIdx++; _updateThemeScroll(); });
function updateSettingsLabels() {
  document.getElementById('settings-title').textContent = t('menu_title');
  document.getElementById('settings-lang-label').textContent = t('menu_lang');
  var langSelect = document.getElementById('settings-lang-select');
  langSelect.value = _langPref;
  var langKeys = { system: 'lang_system', en: 'lang_en', zh: 'lang_zh' };
  for (var li = 0; li < langSelect.options.length; li++) {
    var lk = langKeys[langSelect.options[li].value];
    if (lk) langSelect.options[li].textContent = t(lk);
  }
  document.getElementById('settings-theme-label').textContent = t('menu_theme');
  renderThemeGrid();
}
document.getElementById('sound-btn').addEventListener('click', toggleSound);
_updateSoundBtn();
document.getElementById('settings-btn').addEventListener('click', () => {
  updateSettingsLabels();
  if (_isDebugEnv()) _updateDebugUI();
  var dot = document.querySelector('#settings-btn .settings-dot');
  if (dot) dot.classList.remove('show');
  document.getElementById('settings-modal').classList.add('show');
});
document.getElementById('settings-close').addEventListener('click', () => _closeSettings());
document.getElementById('settings-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) _closeSettings();
});

// Bottom sheet swipe-to-dismiss
(function() {
  var handle = document.getElementById('settings-handle');
  var content = document.getElementById('settings-content');
  var modal = document.getElementById('settings-modal');
  var dragging = false, startY = 0, currentDeltaY = 0, dragStartTime = 0;

  function onStart(e) {
    dragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    currentDeltaY = 0;
    dragStartTime = Date.now();
    content.classList.add('dragging');
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging) return;
    var y = e.touches ? e.touches[0].clientY : e.clientY;
    currentDeltaY = Math.max(0, y - startY); // only allow downward drag
    content.style.transform = 'translateY(' + currentDeltaY + 'px)';
    e.preventDefault();
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    content.classList.remove('dragging');
    var duration = Date.now() - dragStartTime;
    var velocity = duration > 0 ? currentDeltaY / duration : 0;
    // Dismiss if fast swipe down or dragged past 30% of content height
    if (velocity > 0.3 || currentDeltaY > content.offsetHeight * 0.3) {
      content.style.transform = 'translateY(100%)';
      setTimeout(function() {
        modal.classList.remove('show');
        content.style.transform = '';
      }, 300);
    } else {
      content.style.transform = '';
    }
    currentDeltaY = 0;
  }
  handle.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
  handle.addEventListener('mousedown', onStart);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
})();

function _closeSettings() {
  var content = document.getElementById('settings-content');
  var modal = document.getElementById('settings-modal');
  content.style.transform = 'translateY(100%)';
  setTimeout(function() {
    modal.classList.remove('show');
    content.style.transform = '';
  }, 300);
}
document.getElementById('settings-lang-select').addEventListener('change', (e) => {
  setLang(e.target.value);
  updateSettingsLabels();
});
// Theme grid handles its own clicks via renderThemeGrid()
// --- Debug panel (local/dev only) --- (handlers below, vars declared near Turnstile)

function _isDebugEnv() {
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || _cfg('debug', false);
}

function _updateDebugUI() {
  const offBtn = document.getElementById('debug-offline-btn');
  const hintBtn = document.getElementById('debug-hints-btn');
  const energyBtn = document.getElementById('debug-energy-btn');
  if (offBtn) offBtn.textContent = _debugForceOffline ? 'ON' : 'OFF';
  if (hintBtn) hintBtn.textContent = _debugUnlimitedHints ? 'ON' : 'OFF';
  if (energyBtn) energyBtn.textContent = _debugUnlimitedEnergy ? 'ON' : 'OFF';
  // Steam config debug info
  var steamEl = document.getElementById('debug-steam-info');
  if (steamEl && _isElectron) {
    var phase = _appConfig._steamPhase || '-';
    var status = _appConfig._steamConfigStatus || 'pending';
    var ago = _appConfig._steamConfigFetchedAt ? Math.round((Date.now() - _appConfig._steamConfigFetchedAt) / 60000) + 'm ago' : '-';
    var flags = _appConfig.features || {};
    var flagStr = Object.keys(flags).map(function(k) { return k + '=' + (flags[k] ? 'on' : 'off'); }).join(' ');
    steamEl.textContent = 'Steam: ' + phase + ' | ' + status + ' | ' + ago + '\nFlags: ' + (flagStr || 'none');
  }
}

if (_isDebugEnv()) {
  const dbg = document.getElementById('debug-section');
  if (dbg) dbg.style.display = '';

  document.getElementById('debug-offline-btn').addEventListener('click', () => {
    _debugForceOffline = !_debugForceOffline;
    if (_debugForceOffline) {
      _backendOnline = false;
      _levelTotals = {..._getOfflineTotals()};
    } else {
      refreshBackendStatus();
      fetchLevelTotals().then(() => updateWelcomeLevels());
    }
    updateWelcomeLevels();
    _saveDebugConfig();
    _updateDebugUI();
  });

  document.getElementById('debug-hints-btn').addEventListener('click', () => {
    _debugUnlimitedHints = !_debugUnlimitedHints;
    updateHintBtn();
    _saveDebugConfig();
    _updateDebugUI();
  });

  document.getElementById('debug-energy-btn').addEventListener('click', () => {
    _debugUnlimitedEnergy = !_debugUnlimitedEnergy;
    updateEnergyDisplay();
    _saveDebugConfig();
    _updateDebugUI();
  });
}

// Restore saved theme
try {
  const saved = localStorage.getItem('octile-theme');
  if (saved && saved !== 'default') setTheme(saved);
} catch(e) {}

// Control bar
document.getElementById('ctrl-random').addEventListener('click', loadRandomPuzzle);
document.getElementById('ctrl-restart').addEventListener('click', () => {
  if (_feature('energy') && gameOver && !hasEnoughEnergy()) { showEnergyModal(true); return; }
  resetGame(currentPuzzleNumber);
});
document.getElementById('ctrl-undo').addEventListener('click', function() { _kbUndoLastPlacement(); });
document.getElementById('ctrl-rotate').addEventListener('click', function() { _doRotateSelected(); });
document.getElementById('hint-btn').addEventListener('click', showHint);

// Level navigation
document.getElementById('level-prev').addEventListener('click', () => goLevelSlot(currentSlot - 1));
document.getElementById('level-next').addEventListener('click', () => {
  if (!currentLevel) return;
  const nextSlot = currentSlot + 1;
  const total = getEffectiveLevelTotal(currentLevel);
  const completed = getLevelProgress(currentLevel);
  if (nextSlot <= total && _feature('blockUnsolved') && isBlockUnsolved() && nextSlot > completed + 1) {
    showDiamondPurchase(t('unlock_puzzle_name'), UNLOCK_PUZZLE_DIAMOND_COST, () => {
      setLevelProgress(currentLevel, nextSlot - 1);
      goLevelSlot(nextSlot);
    });
    return;
  }
  goLevelSlot(nextSlot);
});

// 3-tier navigation: modal back buttons + backdrop close
document.getElementById('chapter-back').addEventListener('click', () => document.getElementById('chapter-modal').classList.remove('show'));
document.getElementById('path-back').addEventListener('click', () => {
  document.getElementById('path-modal').classList.remove('show');
});
document.getElementById('chapter-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('chapter-modal')) document.getElementById('chapter-modal').classList.remove('show');
});
document.getElementById('path-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('path-modal')) document.getElementById('path-modal').classList.remove('show');
});

// Win card
document.getElementById('win-share-btn').addEventListener('click', shareWin);
document.getElementById('win-view-btn').addEventListener('click', () => {
  document.getElementById('win-overlay').classList.remove('show');
  clearConfetti();
  document.body.classList.add('win-view-mode');
});
document.getElementById('win-back-btn').addEventListener('click', () => {
  document.body.classList.remove('win-view-mode');
  _showWinStep(3);
  document.getElementById('win-overlay').classList.add('show');
});
// Win step advancement: tap step 1 → step 2 → step 3
document.getElementById('win-step1').addEventListener('click', function() {
  if (_winStep === 1) {
    if (!_feature('win_meta')) {
      // Skip reward modal, go straight to step 3
      _showWinStep(3);
      playSound('select');
    } else {
      playSound('achieve'); haptic([30, 20, 60]);
      _showWinRewardModal();
    }
  }
});
document.getElementById('win-step2').addEventListener('click', function() {
  if (_winStep === 2) { _showWinStep(3); playSound('select'); }
});
document.getElementById('win-prev-btn').addEventListener('click', () => {
  document.getElementById('win-overlay').classList.remove('show');
  goLevelSlot(currentSlot - 1);
});
document.getElementById('win-next-btn').addEventListener('click', nextPuzzle);
document.getElementById('win-random-btn').addEventListener('click', winRandom);
document.getElementById('win-menu-btn').addEventListener('click', returnToWelcome);

// Energy display & modal
document.getElementById('energy-display').addEventListener('click', () => showEnergyModal(false));
document.getElementById('energy-close').addEventListener('click', () => document.getElementById('energy-modal').classList.remove('show'));

// Achievement/Goals modal
document.getElementById('achieve-close').addEventListener('click', () => document.getElementById('achieve-modal').classList.remove('show'));
document.getElementById('achieve-tabs').addEventListener('click', e => {
  const btn = e.target.closest('.achieve-tab');
  if (!btn) return;
  _achieveTab = btn.dataset.tab;
  renderAchieveModal();
});

// Profile modal
document.getElementById('profile-btn').addEventListener('click', () => closeSettingsAndDo(showProfileModal));
document.getElementById('profile-close').addEventListener('click', () => document.getElementById('profile-modal').classList.remove('show'));
document.getElementById('profile-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
});
// Messages modal
document.getElementById('messages-close').addEventListener('click', () => document.getElementById('messages-modal').classList.remove('show'));
document.getElementById('messages-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
});
// Multiplier confirm modal
document.getElementById('multiplier-confirm-start').addEventListener('click', () => {
  var modal = document.getElementById('multiplier-confirm-modal');
  var value = modal._pendingValue || 2;
  modal.classList.remove('show');
  activateMultiplier(value);
});
document.getElementById('multiplier-confirm-skip').addEventListener('click', () => {
  var modal = document.getElementById('multiplier-confirm-modal');
  var value = modal._pendingValue || 2;
  modal.classList.remove('show');
  // Save to message center for later claiming
  addClaimableMultiplier(value);
});

// Quit confirm modal
document.getElementById('quit-cancel-btn').addEventListener('click', () => {
  document.getElementById('quit-confirm-modal').classList.remove('show');
});
document.getElementById('quit-confirm-btn').addEventListener('click', () => {
  document.getElementById('quit-confirm-modal').classList.remove('show');
  clearConfetti();
  returnToWelcome();
});

// Auth modal
document.getElementById('auth-close').addEventListener('click', () => document.getElementById('auth-modal').classList.remove('show'));
document.getElementById('auth-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
});
document.getElementById('auth-agree-check').addEventListener('change', function() {
  document.getElementById('auth-magic-btn').disabled = !this.checked;
});
document.getElementById('auth-magic-btn').addEventListener('click', _sendMagicLink);
document.getElementById('auth-magic-resend').addEventListener('click', function() {
  // Resend magic link for the same email
  if (_magicLinkEmail) {
    document.getElementById('auth-email').value = _magicLinkEmail;
    _sendMagicLink();
  } else {
    document.getElementById('auth-form-magic').style.display = '';
    document.getElementById('auth-form-magic-sent').style.display = 'none';
  }
});
// Enter key submits magic link form
document.getElementById('auth-email').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !document.getElementById('auth-magic-btn').disabled) _sendMagicLink();
});

// Scoreboard modal
updateOnlineUI();
document.getElementById('scoreboard-btn').addEventListener('click', () => { tutStep7_LockedFeature(); closeSettingsAndDo(showScoreboardModal); });
document.getElementById('sb-share-btn').addEventListener('click', shareGame);
document.getElementById('scoreboard-close').addEventListener('click', () => document.getElementById('scoreboard-modal').classList.remove('show'));
document.querySelectorAll('.sb-tab').forEach(btn => {
  btn.addEventListener('click', () => switchSbTab(btn.dataset.tab));
});

// Daily challenge leaderboard modal
document.getElementById('dc-lb-close').addEventListener('click', () => document.getElementById('dc-leaderboard-modal').classList.remove('show'));

// Modal backdrop click (with stopPropagation on content)
['help-modal', 'energy-modal', 'achieve-modal', 'scoreboard-modal', 'dc-leaderboard-modal'].forEach(id => {
  const modal = document.getElementById(id);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
});
document.getElementById('help-close').addEventListener('click', () => document.getElementById('help-modal').classList.remove('show'));

// Android back button handler — returns true if handled
var _modalIds = ['dc-leaderboard-modal', 'reward-modal', 'diamond-purchase-modal', 'auth-modal', 'profile-modal', 'help-modal', 'energy-modal', 'achieve-modal', 'scoreboard-modal', 'chapter-modal', 'path-modal', 'messages-modal', 'multiplier-confirm-modal', 'quit-confirm-modal', 'settings-modal'];
function handleAndroidBack() {
  // 1. Close any open modal (highest priority first)
  for (var i = 0; i < _modalIds.length; i++) {
    var el = document.getElementById(_modalIds[i]);
    if (el && el.classList.contains('show')) {
      if (_modalIds[i] === 'settings-modal') _closeSettings();
      else el.classList.remove('show');
      return true;
    }
  }
  // 2. Close win overlay
  var win = document.getElementById('win-overlay');
  if (win && win.classList.contains('show')) {
    win.classList.remove('show');
    clearConfetti();
    returnToWelcome();
    return true;
  }
  // 2.5. Exit win-view-mode (back to win overlay)
  if (document.body.classList.contains('win-view-mode')) {
    document.body.classList.remove('win-view-mode');
    _showWinStep(3);
    document.getElementById('win-overlay').classList.add('show');
    return true;
  }
  // 3. If in gameplay, show quit confirm or return to welcome
  var menuBtn = document.getElementById('menu-btn');
  if (menuBtn && menuBtn.style.display !== 'none') {
    if (gameStarted && !gameOver) {
      document.getElementById('quit-confirm-modal').classList.add('show');
      return true;
    }
    returnToWelcome();
    return true;
  }
  // 4. Not handled — let Android exit
  return false;
}

// --- Keyboard & Mouse controls (PC/Steam) ---
var _kbCursorR = -1, _kbCursorC = -1;
var _inputMode = 'mouse'; // 'mouse' | 'keyboard'

// Track input mode: mouse movement hides keyboard cursor, keyboard shows it
document.addEventListener('mousemove', () => {
  if (_inputMode === 'keyboard') {
    _inputMode = 'mouse';
    document.querySelectorAll('.cell.kb-cursor').forEach(c => c.classList.remove('kb-cursor'));
  }
}, { passive: true });
document.addEventListener('keydown', () => { _inputMode = 'keyboard'; }, { capture: true, passive: true });

function _isModalOpen() {
  for (var i = 0; i < _modalIds.length; i++) {
    var el = document.getElementById(_modalIds[i]);
    if (el && el.classList.contains('show')) return true;
  }
  return document.getElementById('win-overlay').classList.contains('show');
}

function _isInGame() {
  return document.body.classList.contains('in-game') && !gameOver && !paused;
}

function _updateKbCursor() {
  document.querySelectorAll('.cell.kb-cursor').forEach(c => c.classList.remove('kb-cursor'));
  if (_inputMode !== 'keyboard' || _kbCursorR < 0 || _kbCursorC < 0) return;
  var cell = document.querySelector('.cell[data-row="' + _kbCursorR + '"][data-col="' + _kbCursorC + '"]');
  if (cell) cell.classList.add('kb-cursor');
}

function _kbPlaceAtCursor() {
  if (!selectedPiece || selectedPiece.placed || _kbCursorR < 0) return;
  var shape = selectedPiece.currentShape;
  var rows = shape.length, cols = shape[0].length;
  var startR = Math.max(0, Math.min(_kbCursorR, 8 - rows));
  var startC = Math.max(0, Math.min(_kbCursorC, 8 - cols));
  if (canPlace(shape, startR, startC, null)) {
    ensureTimerRunning();
    placePiece(shape, startR, startC, selectedPiece.id);
    recordMove(selectedPiece.id, shape, startR, startC);
    selectedPiece.placed = true;
    selectedPiece = null;
    piecesPlacedCount++;
    playSound('place'); haptic(15);
    renderBoard(); triggerSnap();
    renderPool();
    _updateKbCursor();
    maybeShowEncourageToast();
    checkWin();
    onPiecePlaced();
  }
}

function _kbSelectPieceByIndex(idx) {
  var playable = pieces.filter(p => !p.auto && !p.placed);
  if (idx >= 0 && idx < playable.length) {
    selectPiece(playable[idx]);
  }
}

function _kbUndoLastPlacement() {
  // Remove the most recently placed piece using placement order stack
  if (gameOver) {
    playSound('error');
    return;
  }
  if (!_placementOrder.length) return;
  var lastId = _placementOrder.pop();
  _moveLog.pop();
  var lastPlaced = pieces.find(function(p) { return p.id === lastId; });
  if (!lastPlaced || !lastPlaced.placed) return;
  removePiece(lastPlaced.id);
  lastPlaced.placed = false;
  piecesPlacedCount = Math.max(0, piecesPlacedCount - 1);
  playSound('remove'); haptic(10);
  renderBoard();
  renderPool();
  _updateKbCursor();
  _updateControlButtons();
}

// Escape key closes modals and win overlay; also handles game keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Close modals
    if (handleAndroidBack()) return;
    document.getElementById('help-modal').classList.remove('show');
    document.getElementById('energy-modal').classList.remove('show');
    document.getElementById('achieve-modal').classList.remove('show');
    document.getElementById('scoreboard-modal').classList.remove('show');
    document.getElementById('chapter-modal').classList.remove('show');
    document.getElementById('path-modal').classList.remove('show');
    document.getElementById('diamond-purchase-modal').classList.remove('show');
    if (document.getElementById('win-overlay').classList.contains('show')) {
      document.getElementById('win-overlay').classList.remove('show');
      clearConfetti();
      returnToWelcome();
    }
    return;
  }

  // N: next puzzle (on win screen — step 3 overlay, or reward modal during win flow)
  if ((e.key === 'n' || e.key === 'N') && (
    document.getElementById('win-overlay').classList.contains('show') ||
    (document.getElementById('reward-modal').classList.contains('show') && gameOver)
  )) {
    e.preventDefault();
    if (document.getElementById('reward-modal').classList.contains('show')) {
      var btn = document.getElementById('reward-primary');
      if (btn) btn.click();
    } else if (!_isDailyChallenge) {
      nextPuzzle();
    }
    return;
  }

  // Don't handle game keys if a modal is open or input is focused
  if (_isModalOpen()) return;
  var tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  // In-game keyboard controls
  if (_isInGame()) {
    // 1-8: select piece by index
    if (e.key >= '1' && e.key <= '8') {
      e.preventDefault();
      _kbSelectPieceByIndex(parseInt(e.key) - 1);
      return;
    }

    // R: rotate selected piece
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      _doRotateSelected();
      return;
    }

    // Arrow keys: move cursor on board
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      if (_kbCursorR < 0) { _kbCursorR = 3; _kbCursorC = 3; }
      if (e.key === 'ArrowUp') _kbCursorR = Math.max(0, _kbCursorR - 1);
      if (e.key === 'ArrowDown') _kbCursorR = Math.min(7, _kbCursorR + 1);
      if (e.key === 'ArrowLeft') _kbCursorC = Math.max(0, _kbCursorC - 1);
      if (e.key === 'ArrowRight') _kbCursorC = Math.min(7, _kbCursorC + 1);
      _updateKbCursor();
      return;
    }

    // Enter/Space: place piece at cursor (init cursor if needed)
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
      if (_kbCursorR < 0) { _kbCursorR = 3; _kbCursorC = 3; _updateKbCursor(); }
      _kbPlaceAtCursor();
      return;
    }

    // Backspace or Ctrl+Z: undo last placement
    if (e.key === 'Backspace' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      _kbUndoLastPlacement();
      return;
    }

    // H: show hint
    if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      showHint();
      return;
    }

    // P: pause/resume
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (paused) resumeGame(); else pauseGame();
      return;
    }

    // Z: toggle zen mode — "the puzzle can breathe"
    if ((e.key === 'z' || e.key === 'Z') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      var entering = !document.body.classList.contains('zen-mode');
      document.body.classList.toggle('zen-mode', entering);
      showSimpleToast(entering ? '\uD83E\uDDD8' : '', entering ? 'Zen Mode' : 'Zen Mode Off', entering ? 1500 : 1000);
      return;
    }
  }

  // P to resume if paused
  if (document.body.classList.contains('in-game') && paused && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault();
    resumeGame();
    return;
  }

  // ?: open help (keyboard shortcuts)
  if (e.key === '?') {
    e.preventDefault();
    document.getElementById('help-modal').classList.add('show');
    var kbSec = document.getElementById('kb-shortcuts');
    if (kbSec) kbSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

});

// Mouse wheel on pool: cycle through pieces
document.getElementById('pool').addEventListener('wheel', (e) => {
  if (gameOver || paused) return;
  var playable = pieces.filter(p => !p.auto && !p.placed);
  if (playable.length === 0) return;
  var curIdx = selectedPiece ? playable.indexOf(selectedPiece) : -1;
  var dir = e.deltaY > 0 ? 1 : -1;
  var nextIdx = curIdx < 0 ? 0 : (curIdx + dir + playable.length) % playable.length;
  selectPiece(playable[nextIdx]);
  e.preventDefault();
}, { passive: false });

// Right-click on placed piece: remove it
document.getElementById('board').addEventListener('contextmenu', (e) => {
  var cell = e.target.closest('.cell[data-piece-id]');
  if (!cell || gameOver || paused) return;
  var pid = cell.dataset.pieceId;
  var piece = getPieceById(pid);
  if (!piece || piece.auto) return;
  e.preventDefault();
  removePiece(pid);
  piece.placed = false;
  piecesPlacedCount = Math.max(0, piecesPlacedCount - 1);
  var oi = _placementOrder.lastIndexOf(pid);
  if (oi !== -1) { _placementOrder.splice(oi, 1); _moveLog.splice(oi, 1); }
  playSound('remove'); haptic(10);
  renderBoard();
  renderPool();
  _updateKbCursor();
});

// Init — show offline defaults first, then update after health check
showWelcomeState();
applyLanguage();
updateEnergyDisplay();
updateExpDisplay();
updateDiamondDisplay();
_checkAuthCallback();
_checkPendingAuth();
_fxInit();
// Init new features (gated by feature flags) — wait for config to load
_configReady.then(function() {
  if (_feature('daily_tasks')) getDailyTasks(); // generate if new day
  if (_feature('daily_tasks')) checkDailyTaskNotification();
  if (_feature('messages')) updateMessageBadge();
  if (_feature('diamond_multiplier')) checkMultiplierOnLoad();
});

// Daily check-in (skip on Electron — no check-in system) — wait for config
_configReady.then(function() {
  if (_feature('diamonds')) {
    var _pendingCheckin = doDailyCheckin();
    if (_pendingCheckin) {
      var _showCheckinAfterSplash = function() {
        if (!splashDismissed) { setTimeout(_showCheckinAfterSplash, 1000); return; }
        setTimeout(function() { showDailyCheckinToast(_pendingCheckin.reward, _pendingCheckin.combo); }, 800);
      };
      _showCheckinAfterSplash();
    }
  }
});
// Desktop first-visit toast: keyboard shortcuts hint
if (matchMedia('(pointer: fine)').matches && !localStorage.getItem('octile_kb_hint_shown')) {
  localStorage.setItem('octile_kb_hint_shown', '1');
  setTimeout(function() { showSimpleToast('\u2328\uFE0F', t('kb_hint_toast'), 3500); }, 2000);
}

if (_feature('energy')) setInterval(updateEnergyDisplay, 60000);
// Unclaimed reward reminders: 5s after load, then every 15min
if (_feature('diamonds')) {
  setTimeout(checkUnclaimedRewards, 5000);
  setInterval(checkUnclaimedRewards, 15 * 60 * 1000);
}
// Wait for config + steam flags, then init packs + fetch level totals + check backend health
_steamConfigReady.then(() => Promise.all([_initPacks(), fetchLevelTotals(), refreshBackendStatus()])).then(() => {
  // Re-apply feature-gated UI now that steam flags are loaded
  updateEnergyDisplay();
  // --- Feature-gated UI: hide header displays and nav buttons based on features ---
  var _featureDisplayMap = [
    ['diamonds', 'diamond-display'], ['energy', 'energy-display'],
    ['diamond_multiplier', 'multiplier-display'], ['hints', 'hint-btn']
  ];
  for (var _fi = 0; _fi < _featureDisplayMap.length; _fi++) {
    var _fel = document.getElementById(_featureDisplayMap[_fi][1]);
    if (_fel && !_feature(_featureDisplayMap[_fi][0])) _fel.style.display = 'none';
  }
  // EXP display: hidden when diamonds (economy) is off
  var _expEl = document.getElementById('exp-display');
  if (_expEl && !_feature('diamonds')) _expEl.style.display = 'none';
  // Nav buttons: hide based on features
  var _featureNavMap = [
    ['daily_tasks', 'goals-btn'], ['scoreboard', 'scoreboard-btn'], ['messages', 'messages-btn']
  ];
  for (var _fni = 0; _fni < _featureNavMap.length; _fni++) {
    var _fnel = document.getElementById(_featureNavMap[_fni][1]);
    if (_fnel && !_feature(_featureNavMap[_fni][0])) _fnel.style.display = 'none';
  }
  // --- Electron: layout adjustments ---
  if (_isElectron) {
    var _navPrimary = document.querySelector('.settings-nav-primary');
    if (_navPrimary) { _navPrimary.style.gridTemplateColumns = '1fr'; _navPrimary.style.maxWidth = '280px'; _navPrimary.style.margin = '0 auto 10px'; }
    var _navSecondary = document.querySelector('.settings-nav-secondary');
    if (_navSecondary && !_feature('scoreboard') && !_feature('messages')) _navSecondary.style.display = 'none';
    var _navUtility = document.querySelector('.settings-nav-utility');
    if (_navUtility) { _navUtility.style.display = 'grid'; _navUtility.style.gridTemplateColumns = '1fr'; _navUtility.style.maxWidth = '280px'; _navUtility.style.margin = '0 auto 16px'; _navUtility.style.paddingBottom = '16px'; _navUtility.style.borderBottom = '1px solid rgba(255,255,255,0.08)'; }
    var _helpBtn = document.getElementById('help-btn');
    if (_helpBtn) { _helpBtn.classList.add('primary'); _helpBtn.style.fontSize = ''; _helpBtn.style.padding = ''; }
    _appConfig.puzzleSet = 11378;
  }
  // --- Pure mode: layout adjustments ---
  if (_isPureMode) {
    if (!isAuthEnabled()) {
      var _profBtn = document.getElementById('profile-btn');
      if (_profBtn) _profBtn.style.display = 'none';
    }
    var _pNavPrimary = document.querySelector('.settings-nav-primary');
    if (_pNavPrimary && !isAuthEnabled()) _pNavPrimary.style.display = 'none';
    var _pNavSecondary = document.querySelector('.settings-nav-secondary');
    if (_pNavSecondary && !_feature('scoreboard') && !_feature('messages')) _pNavSecondary.style.display = 'none';
    var _pNavUtility = document.querySelector('.settings-nav-utility');
    if (_pNavUtility) { _pNavUtility.style.display = 'grid'; _pNavUtility.style.gridTemplateColumns = '1fr'; _pNavUtility.style.maxWidth = '280px'; _pNavUtility.style.margin = '0 auto 16px'; _pNavUtility.style.paddingBottom = '16px'; _pNavUtility.style.borderBottom = '1px solid rgba(255,255,255,0.08)'; }
    var _pHelpBtn = document.getElementById('help-btn');
    if (_pHelpBtn) { _pHelpBtn.classList.add('primary'); }
    var _pShareBtn = document.getElementById('win-share-btn');
    if (_pShareBtn) _pShareBtn.style.display = 'none';
    // Pure mode: show clean puzzle-only help (no daily challenge, no hints/energy/tasks)
    document.getElementById('help-body').innerHTML = t(_helpBodyKey());
  }
  showWelcomeState();
  updateOnlineUI();
  // Flush any queued feedback
  if (typeof _flushFeedbackQueue === 'function') _flushFeedbackQueue();
  // Init gamepad support (Steam only)
  if (typeof _gpInit === 'function') _gpInit();
});
// Start managed health polling (stops when hidden/in-game, resumes on return)
_startHealthPoll();

// URL parameter: ?p=N skips splash/welcome, starts puzzle N directly
(function handleUrlParam() {
  const params = new URLSearchParams(location.search);
  const p = parseInt(params.get('p'));
  if (p >= 1 && p <= TOTAL_PUZZLE_COUNT) {
    // Skip splash immediately
    splashDismissed = true;
    const splash = document.getElementById('splash');
    if (splash) splash.remove();
    // Start game directly
    startGame(p);
  }
})();

// FullPack ready event: update Daily Challenge UI
document.addEventListener('fullpack-ready', function() {
  console.info('[Octile] FullPack ready event received');
  if (typeof renderDailyChallengeCard === 'function') {
    renderDailyChallengeCard();
  }
});

// Debug commands (dev only, not exposed in UI)
window.clearGameState = function() {
  localStorage.clear();
  sessionStorage.clear();
  console.info('[Octile] Game state cleared');
};
window.clearGameStateAndReload = function() {
  localStorage.clear();
  sessionStorage.clear();
  location.reload();
};

// Service worker registration (skip in Electron — local files, Steam handles updates)
if ('serviceWorker' in navigator && !_isElectron) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
