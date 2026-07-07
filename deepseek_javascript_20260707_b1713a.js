// ===== НАСТРОЙКИ SUPABASE =====
const SUPABASE_URL = 'https://xxxxxxxxxxxxxxx.supabase.co';        // замените
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // замените

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== СПИСОК СКИНОВ =====
const SKINS = [
  { name: 'AK-47 | Redline', price: 120 },
  { name: 'AWP | Dragon Lore', price: 1500 },
  { name: 'M4A4 | Howl', price: 800 },
  { name: 'Glock-18 | Fade', price: 300 },
  { name: 'USP-S | Kill Confirmed', price: 250 },
  { name: 'Desert Eagle | Code Red', price: 180 },
  { name: 'SSG 08 | Blood in the Water', price: 90 },
  { name: 'P250 | Splash', price: 40 },
];

let currentUser = null;
let currentBalance = 0;

// ===== DOM-ЭЛЕМЕНТЫ =====
const wheel = document.getElementById('wheel');
const spinBtn = document.getElementById('spinBtn');
const betInput = document.getElementById('betAmount');
const resultMsg = document.getElementById('resultMessage');
const balanceDisplay = document.getElementById('balanceDisplay');
const depositBtn = document.getElementById('depositBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const usernameSpan = document.getElementById('username');

// ===== ОТРИСОВКА РУЛЕТКИ =====
function renderWheel(highlightIndex = -1) {
  wheel.innerHTML = '';
  SKINS.forEach((skin, idx) => {
    const div = document.createElement('div');
    div.className = 'item-skin';
    if (idx === highlightIndex) div.classList.add('winner');
    div.textContent = `${skin.name} (${skin.price}$)`;
    wheel.appendChild(div);
  });
}
renderWheel();

// ===== ПОЛУЧЕНИЕ/ОБНОВЛЕНИЕ БАЛАНСА =====
async function fetchBalance() {
  if (!currentUser) return;
  const { data, error } = await supabase
    .from('users')
    .select('balance, username')
    .eq('discord_id', currentUser.id)
    .single();
  if (data) {
    currentBalance = data.balance;
    usernameSpan.textContent = data.username || currentUser.user_metadata?.full_name || 'User';
    updateUI();
  }
}

async function updateBalance(amount) {
  if (!currentUser) return;
  const { data, error } = await supabase
    .from('users')
    .update({ balance: supabase.rpc('increment', { x: amount }) })
    .eq('discord_id', currentUser.id)
    .select('balance')
    .single();
  if (data) {
    currentBalance = data.balance;
    updateUI();
    return data.balance;
  }
  return null;
}

// ===== ОБНОВЛЕНИЕ UI =====
function updateUI() {
  balanceDisplay.textContent = `Баланс: ${currentBalance}`;
  if (currentUser) {
    loginBtn.style.display = 'none';
    userInfo.style.display = 'flex';
  } else {
    loginBtn.style.display = 'inline-block';
    userInfo.style.display = 'none';
    resultMsg.textContent = '👋 Войдите, чтобы начать игру';
  }
}

// ===== АВТОРИЗАЦИЯ ЧЕРЕЗ DISCORD (Supabase OAuth) =====
loginBtn.addEventListener('click', async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: window.location.origin }
  });
  if (error) alert('Ошибка входа: ' + error.message);
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  currentUser = null;
  currentBalance = 0;
  updateUI();
  renderWheel();
  resultMsg.textContent = '👋 Вы вышли из аккаунта';
});

// ===== ПРОВЕРКА СЕССИИ ПРИ ЗАГРУЗКЕ =====
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    await fetchBalance();
    updateUI();
    resultMsg.textContent = '🎮 Готов к игре!';
  } else {
    // Проверка на callback после входа
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      currentUser = user;
      await fetchBalance();
      updateUI();
      resultMsg.textContent = '🎮 Добро пожаловать!';
    }
  }
}

// ===== ПОПОЛНЕНИЕ БАЛАНСА =====
depositBtn.addEventListener('click', async () => {
  if (!currentUser) {
    alert('Сначала войдите через Discord!');
    return;
  }
  const amount = 100;
  const newBalance = await updateBalance(amount);
  if (newBalance !== null) {
    resultMsg.textContent = `✅ Баланс пополнен на ${amount}$`;
  } else {
    alert('Ошибка пополнения');
  }
});

// ===== РУЛЕТКА =====
spinBtn.addEventListener('click', async () => {
  if (!currentUser) {
    alert('Войдите через Discord, чтобы играть!');
    return;
  }
  const bet = parseInt(betInput.value);
  if (isNaN(bet) || bet <= 0) {
    resultMsg.textContent = '❌ Введите корректную ставку!';
    return;
  }
  if (bet > currentBalance) {
    resultMsg.textContent = '❌ Недостаточно средств!';
    return;
  }

  // Списываем ставку
  const newBalance = await updateBalance(-bet);
  if (newBalance === null) {
    resultMsg.textContent = '❌ Ошибка при списании';
    return;
  }
  currentBalance = newBalance;
  updateUI();

  // Выбираем выигрыш
  const winIndex = Math.floor(Math.random() * SKINS.length);
  const winPrice = SKINS[winIndex].price;
  const winAmount = Math.floor(winPrice * (0.5 + Math.random() * 0.8));

  // Анимация
  let step = 0;
  const interval = setInterval(() => {
    renderWheel(step % SKINS.length);
    step++;
    if (step > 20) {
      clearInterval(interval);
      renderWheel(winIndex);
      // Начисляем выигрыш
      updateBalance(winAmount).then((finalBalance) => {
        if (finalBalance !== null) {
          currentBalance = finalBalance;
          updateUI();
          resultMsg.textContent = `🎉 Вы выиграли ${winAmount}$ (${SKINS[winIndex].name})!`;
        }
      });
    }
  }, 80);
});

// ===== ЗАПУСК =====
checkSession();