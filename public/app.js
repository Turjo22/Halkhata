const API_BASE = '/api';

// State
let currentUser = null;
let currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

const navUserName = document.getElementById('nav-user-name');
const dashUserName = document.getElementById('dash-user-name');
const navProfilePic = document.getElementById('nav-profile-pic');
const profileUpload = document.getElementById('profile-upload');
const logoutBtn = document.getElementById('logout-btn');

const navLinks = document.querySelectorAll('.nav-link');
const tabContents = document.querySelectorAll('.tab-content');

const monthPicker = document.getElementById('current-month-picker');

// Init
document.addEventListener('DOMContentLoaded', () => {
    // Check local storage for user
    const storedUser = localStorage.getItem('halkhata_user');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        showApp();
    }
    
    monthPicker.value = currentMonth;
    monthPicker.addEventListener('change', (e) => {
        currentMonth = e.target.value;
        loadAllData();
    });
});

// Auth
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('login-name').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name, password })
        });
        const data = await res.json();
        
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('halkhata_user', JSON.stringify(currentUser));
            showApp();
        } else {
            loginError.textContent = data.message || 'Login failed';
        }
    } catch (err) {
        loginError.textContent = 'Network error. Make sure server is running.';
    }
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('halkhata_user');
    currentUser = null;
    mainApp.classList.remove('active');
    loginScreen.classList.add('active');
});

function showApp() {
    loginScreen.classList.remove('active');
    mainApp.classList.add('active');
    
    navUserName.textContent = currentUser.name;
    dashUserName.textContent = currentUser.name;
    
    if (currentUser.profile_pic) {
        navProfilePic.src = currentUser.profile_pic;
    } else {
        navProfilePic.src = 'https://ui-avatars.com/api/?name=' + currentUser.name + '&background=random';
    }
    
    // Set default meal date to today
    document.getElementById('meal-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('voucher-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('deposit-date').value = new Date().toISOString().slice(0, 10);
    
    loadAllData();
    populateUsersDropdown();
}

// Navigation
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navLinks.forEach(l => l.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active'));
        
        link.classList.add('active');
        document.getElementById(link.dataset.target).classList.add('active');
    });
});

// Profile Upload
profileUpload.addEventListener('change', async (e) => {
    if (!e.target.files.length) return;
    
    const file = e.target.files[0];
    const reader = new FileReader();
    
    reader.onloadend = async () => {
        const base64Image = reader.result;
        
        try {
            const res = await fetch(`${API_BASE}/upload-dp`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId: currentUser.id, base64Image })
            });
            const data = await res.json();
            if (data.success) {
                currentUser.profile_pic = data.profile_pic;
                localStorage.setItem('halkhata_user', JSON.stringify(currentUser));
                navProfilePic.src = data.profile_pic;
            }
        } catch (err) {
            alert('Upload failed');
        }
    };
    
    reader.readAsDataURL(file);
});

// Data Fetching
async function loadAllData() {
    loadDashboard();
    loadVouchers();
    loadDeposits();
}

async function loadDashboard() {
    try {
        const res = await fetch(`${API_BASE}/dashboard/${currentUser.id}/${currentMonth}`);
        const data = await res.json();
        
        if (data.success) {
            const d = data.data;
            document.getElementById('stat-my-meals').textContent = (d.userMeals || 0).toFixed(1);
            document.getElementById('stat-meal-rate').textContent = (d.mealRate || 0).toFixed(2);
            document.getElementById('stat-my-expense').textContent = (d.monthExpense || 0).toFixed(2);
            document.getElementById('stat-my-deposit').textContent = (d.totalDeposit || 0).toFixed(2);
            
            const balDisplay = document.getElementById('balance-display');
            const statBal = document.getElementById('stat-balance');
            const balLabel = document.getElementById('balance-label');
            
            balDisplay.className = 'balance-display';
            statBal.textContent = `৳ ${Math.abs(d.balance).toFixed(2)}`;
            
            if (d.balance > 0) {
                balDisplay.classList.add('credit');
                balLabel.textContent = 'You will get (Credit)';
            } else if (d.balance < 0) {
                balDisplay.classList.add('debit');
                balLabel.textContent = 'You will pay (Debit)';
            } else {
                balLabel.textContent = 'Settled';
            }
            
            loadUsersTable();
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadUsersTable() {
    try {
        const res = await fetch(`${API_BASE}/users/${currentMonth}`);
        const data = await res.json();
        if (data.success) {
            // Also need meal rate for balance
            const rateRes = await fetch(`${API_BASE}/dashboard/${currentUser.id}/${currentMonth}`);
            const rateData = await rateRes.json();
            const mealRate = rateData.data.mealRate || 0;
            
            const tbody = document.querySelector('#all-users-table tbody');
            tbody.innerHTML = '';
            
            data.data.forEach(u => {
                const expense = u.userMeals * mealRate;
                const balance = u.userDep - expense;
                
                let balHtml = '';
                if (balance > 0) balHtml = `<span style="color:var(--success)">+৳${balance.toFixed(2)}</span>`;
                else if (balance < 0) balHtml = `<span style="color:var(--danger)">-৳${Math.abs(balance).toFixed(2)}</span>`;
                else balHtml = `<span>৳0.00</span>`;
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div class="user-cell">
                            <img src="${u.profile_pic || 'https://ui-avatars.com/api/?name='+u.name+'&background=random'}" class="user-avatar">
                            ${u.name}
                        </div>
                    </td>
                    <td>${u.userMeals.toFixed(1)}</td>
                    <td>৳${u.userDep.toFixed(2)}</td>
                    <td>৳${expense.toFixed(2)}</td>
                    <td>${balHtml}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch(e) {}
}

async function populateUsersDropdown() {
    try {
        const res = await fetch(`${API_BASE}/users/${currentMonth}`);
        const data = await res.json();
        if (data.success) {
            const select = document.getElementById('deposit-user');
            select.innerHTML = '<option value="">Select User</option>';
            data.data.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = u.name;
                select.appendChild(opt);
            });
        }
    } catch(e){}
}

// Form Submissions
document.getElementById('meal-entry-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('meal-date').value;
    const count = document.getElementById('meal-count').value;
    const msg = document.getElementById('meal-msg');
    
    try {
        const res = await fetch(`${API_BASE}/meals`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: currentUser.id, date, count })
        });
        const data = await res.json();
        if (data.success) {
            msg.textContent = 'Meal saved successfully!';
            msg.className = 'msg success-msg';
            setTimeout(() => msg.textContent = '', 3000);
            loadDashboard();
        }
    } catch(err) {
        msg.textContent = 'Failed to save meal.';
        msg.className = 'msg error-msg';
    }
});

// Vouchers
document.getElementById('btn-add-voucher').addEventListener('click', () => {
    document.getElementById('voucher-form-panel').classList.remove('hidden');
});
document.getElementById('btn-cancel-voucher').addEventListener('click', () => {
    document.getElementById('voucher-form-panel').classList.add('hidden');
});

document.getElementById('voucher-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('voucher-date').value;
    const elements = document.getElementById('voucher-elements').value;
    const expense = document.getElementById('voucher-expense').value;
    const msg = document.getElementById('voucher-msg');
    
    try {
        const res = await fetch(`${API_BASE}/vouchers`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ date, elements, expense })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('voucher-form-panel').classList.add('hidden');
            document.getElementById('voucher-form').reset();
            document.getElementById('voucher-date').value = new Date().toISOString().slice(0, 10);
            loadVouchers();
            loadDashboard();
        }
    } catch(err) {
        msg.textContent = 'Failed to add voucher.';
        msg.className = 'msg error-msg';
    }
});

async function loadVouchers() {
    try {
        const res = await fetch(`${API_BASE}/vouchers/${currentMonth}`);
        const data = await res.json();
        if (data.success) {
            const tbody = document.querySelector('#vouchers-table tbody');
            tbody.innerHTML = '';
            data.data.forEach(v => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${v.date}</td>
                    <td>${v.elements}</td>
                    <td>৳${v.expense.toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {}
}

// Deposits
document.getElementById('btn-add-deposit').addEventListener('click', () => {
    document.getElementById('deposit-form-panel').classList.remove('hidden');
});
document.getElementById('btn-cancel-deposit').addEventListener('click', () => {
    document.getElementById('deposit-form-panel').classList.add('hidden');
});

document.getElementById('deposit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('deposit-date').value;
    const user_id = document.getElementById('deposit-user').value;
    const amount = document.getElementById('deposit-amount').value;
    const msg = document.getElementById('deposit-msg');
    
    try {
        const res = await fetch(`${API_BASE}/deposits`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id, date, amount })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('deposit-form-panel').classList.add('hidden');
            document.getElementById('deposit-form').reset();
            document.getElementById('deposit-date').value = new Date().toISOString().slice(0, 10);
            loadDeposits();
            loadDashboard();
        }
    } catch(err) {
        msg.textContent = 'Failed to add deposit.';
        msg.className = 'msg error-msg';
    }
});

async function loadDeposits() {
    try {
        const res = await fetch(`${API_BASE}/deposits/${currentMonth}`);
        const data = await res.json();
        if (data.success) {
            const tbody = document.querySelector('#deposits-table tbody');
            tbody.innerHTML = '';
            data.data.forEach(d => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${d.date}</td>
                    <td>${d.name}</td>
                    <td>৳${d.amount.toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {}
}
