const API = '/api/v1';
let processId = '';

function headers() {
  const s = document.getElementById('secret').value.trim();
  return s ? { 'X-Kaspi-Session-Setup-Secret': s, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function msg(el, text, type) {
  el.className = 'msg ' + type;
  el.textContent = text;
}

async function requestCode() {
  const phone = document.getElementById('phone').value.replace(/\D/g, '');
  if (phone.length < 10) { msg(document.getElementById('msgBox'), 'Введите корректный номер телефона', 'error'); return; }
  const btn = document.getElementById('btnRequest');
  btn.disabled = true; btn.textContent = '...';
  try {
    const res = await fetch(API + '/billing/kaspi/setup/request-code', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ phoneNumber: phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Ошибка');
    processId = data.processId || '';
    document.getElementById('otpSection').style.display = 'block';
    msg(document.getElementById('msgBox'), 'Код отправлен. Введите OTP из SMS / приложения Kaspi.', 'success');
  } catch (e) {
    msg(document.getElementById('msgBox'), e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Отправить код';
  }
}

async function verifyOtp() {
  const otp = document.getElementById('otp').value.trim();
  if (!otp || otp.length < 4) { msg(document.getElementById('msgBox'), 'Введите код из SMS', 'error'); return; }
  const btn = document.getElementById('btnVerify');
  btn.disabled = true; btn.textContent = '...';
  try {
    const res = await fetch(API + '/billing/kaspi/setup/verify-otp', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ processId, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Ошибка верификации');
    msg(document.getElementById('msgBox'), 'Сессия сохранена. Kaspi готов к работе.', 'success');
    document.getElementById('otp').value = '';
    checkStatus();
  } catch (e) {
    msg(document.getElementById('msgBox'), e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Подтвердить и сохранить';
  }
}

async function checkStatus() {
  const btn = document.getElementById('btnStatus');
  btn.disabled = true; btn.textContent = '...';
  try {
    const res = await fetch(API + '/billing/kaspi/setup/status', { headers: headers() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Ошибка');
    const box = document.getElementById('statusBox');
    box.innerHTML = '<div class="status">' +
      '<p><span>Сессия в API:</span><span>' + (data.configured ? '✅ да' : '❌ нет') + '</span></p>' +
      '<p><span>Kaspi check:</span><span>' + (data.sessionActive ? '✅ активна' : '⚠️ неактивна / ошибка') + '</span></p>' +
    '</div>';
  } catch (e) {
    msg(document.getElementById('msgBox'), e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Проверить статус';
  }
}

document.getElementById('btnRequest').addEventListener('click', requestCode);
document.getElementById('btnVerify').addEventListener('click', verifyOtp);
document.getElementById('btnStatus').addEventListener('click', checkStatus);
