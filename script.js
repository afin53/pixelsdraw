// 1. Підключення до бази (використовую твої ключі)
const SUPABASE_URL = 'https://gisxvbtkjbiagslporjq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_o4Z1p2Y6_OzV0cH_BptYew_BNp8MpVY';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Змінні стану
let currentUser = null;
let currentTool = 'brush'; // 'brush' або 'eraser'
let currentColor = '#ff0000';
const pixelMap = {}; // Зберігатиме дані у форматі: "x,y" : "нікнейм"

// 3. Елементи інтерфейсу
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');
const currentUserDisplay = document.getElementById('current-user-display');

const colorPicker = document.getElementById('color-picker');
const brushBtn = document.getElementById('brush-btn');
const eraserBtn = document.getElementById('eraser-btn');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');

// 4. Логіка входу (Логін)
loginBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name.length > 0) {
        currentUser = name;
        loginScreen.style.display = 'none';
        appScreen.style.display = 'block';
        currentUserDisplay.innerText = `Ви увійшли як: ${currentUser}`;
        loadPixels(); // Завантажуємо малюнки лише після входу
        subscribeToRealtime(); // Підключаємося до оновлень
    } else {
        alert('Будь ласка, введіть нікнейм!');
    }
});

// 5. Вибір інструментів
colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    currentTool = 'brush';
    updateToolUI();
});

brushBtn.addEventListener('click', () => {
    currentTool = 'brush';
    updateToolUI();
});

eraserBtn.addEventListener('click', () => {
    currentTool = 'eraser';
    updateToolUI();
});

function updateToolUI() {
    brushBtn.classList.toggle('active', currentTool === 'brush');
    eraserBtn.classList.toggle('active', currentTool === 'eraser');
}

// 6. Малювання на полотні
function drawPixelOnCanvas(x, y, color, nickname) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
    pixelMap[`${x},${y}`] = nickname; // Записуємо, хто це намалював
}

canvas.addEventListener('mousedown', async (e) => {
    // Вираховуємо координати кліку
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    
    // Якщо вибрано ластік, малюємо білим кольором
    const colorToSend = currentTool === 'eraser' ? '#ffffff' : currentColor;

    // Малюємо відразу в себе, щоб не чекати сервер
    drawPixelOnCanvas(x, y, colorToSend, currentUser);

    // Відправляємо в Supabase
    await supabase.from('pixels').insert([
        { x: x, y: y, color: colorToSend, user_nickname: currentUser }
    ]);
});

// 7. Показ нікнейма при наведенні (Hover)
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    const key = `${x},${y}`;
    
    const author = pixelMap[key];

    if (author && author !== '#ffffff') { // Не показуємо нік для стертих (білих) пікселів
        tooltip.innerText = `Малював: ${author}`;
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
        tooltip.style.display = 'block';
    } else {
        tooltip.style.display = 'none';
    }
});

canvas.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none'; // Ховаємо тултип, коли курсор йде з полотна
});

// 8. Завантаження малюнка з бази
async function loadPixels() {
    const { data, error } = await supabase.from('pixels').select('*');
    if (data) {
        data.forEach(p => drawPixelOnCanvas(p.x, p.y, p.color, p.user_nickname));
    }
}

// 9. Realtime (щоб бачити чужі кліки)
function subscribeToRealtime() {
    supabase.channel('pixels_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pixels' }, payload => {
            const { x, y, color, user_nickname } = payload.new;
            // Малюємо чужий піксель тільки якщо це не ми самі (щоб не малювати двічі)
            if (user_nickname !== currentUser) {
                drawPixelOnCanvas(x, y, color, user_nickname);
            }
        })
        .subscribe();
}
