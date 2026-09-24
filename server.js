const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Increase JSON limit to handle Base64 images
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static('public'));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/halkhata';

mongoose.connect(MONGODB_URI)
  .then(async () => {
      console.log('Connected to MongoDB');
      await initializeUsers();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Schemas & Models
const userSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    password: { type: String },
    profile_pic: { type: String, default: '' } // Will store Base64 string
});
const User = mongoose.model('User', userSchema);

const mealSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: String,
    count: Number
});
const Meal = mongoose.model('Meal', mealSchema);

const voucherSchema = new mongoose.Schema({
    date: String,
    elements: String,
    expense: Number
});
const Voucher = mongoose.model('Voucher', voucherSchema);

const depositSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: String,
    amount: Number
});
const Deposit = mongoose.model('Deposit', depositSchema);

// Initialize Hardcoded Users
async function initializeUsers() {
    const hardcodedUsers = [
        { name: 'Sian', password: '2008032' },
        { name: 'Tanim', password: '2008047' },
        { name: 'Istiak', password: '2008024' },
        { name: 'Emon', password: '2008029' },
        { name: 'Turjo', password: '2008022' }
    ];

    for (const u of hardcodedUsers) {
        const exists = await User.findOne({ name: u.name });
        if (!exists) {
            await User.create(u);
        }
    }
}

// API Endpoints

app.post('/api/login', async (req, res) => {
    try {
        const { name, password } = req.body;
        const user = await User.findOne({ name, password });
        if (user) {
            // Map _id to id for frontend compatibility
            const userData = user.toObject();
            userData.id = userData._id;
            res.json({ success: true, user: userData });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/upload-dp', async (req, res) => {
    try {
        const { userId, base64Image } = req.body;
        if (!base64Image || !userId) return res.status(400).json({ error: 'Missing data' });
        
        await User.findByIdAndUpdate(userId, { profile_pic: base64Image });
        res.json({ success: true, profile_pic: base64Image });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/meals', async (req, res) => {
    try {
        const { user_id, date, count } = req.body;
        const existingMeal = await Meal.findOne({ user_id, date });
        
        if (existingMeal) {
            existingMeal.count = count;
            await existingMeal.save();
        } else {
            await Meal.create({ user_id, date, count });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/vouchers', async (req, res) => {
    try {
        const { date, elements, expense } = req.body;
        await Voucher.create({ date, elements, expense });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/deposits', async (req, res) => {
    try {
        const { user_id, date, amount } = req.body;
        await Deposit.create({ user_id, date, amount });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/dashboard/:userId/:monthPrefix', async (req, res) => {
    try {
        const { userId, monthPrefix } = req.params;
        const regex = new RegExp(`^${monthPrefix}`); // matches '2026-09'

        const [allMeals, userMeals, vouchers, deposits, users] = await Promise.all([
            Meal.find({ date: regex }),
            Meal.find({ user_id: userId, date: regex }),
            Voucher.find({ date: regex }),
            Deposit.find({ user_id: userId, date: regex }),
            User.find()
        ]);

        const totalMeals = allMeals.reduce((sum, m) => sum + m.count, 0);
        const userMealsCount = userMeals.reduce((sum, m) => sum + m.count, 0);
        const totalVoucherExpense = vouchers.reduce((sum, v) => sum + v.expense, 0);
        const totalDeposit = deposits.reduce((sum, d) => sum + d.amount, 0);

        let mealRate = 0;
        if (totalMeals > 0) {
            mealRate = totalVoucherExpense / totalMeals;
        }

        const monthExpense = userMealsCount * mealRate;
        const balance = totalDeposit - monthExpense;

        const usersData = users.map(u => {
            const doc = u.toObject();
            doc.id = doc._id;
            return doc;
        });

        res.json({
            success: true,
            data: {
                totalMeals,
                userMeals: userMealsCount,
                totalVoucherExpense,
                totalDeposit,
                mealRate,
                monthExpense,
                balance,
                users: usersData
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users/:monthPrefix', async (req, res) => {
    try {
        const { monthPrefix } = req.params;
        const regex = new RegExp(`^${monthPrefix}`);

        const users = await User.find();
        const meals = await Meal.find({ date: regex });
        const deposits = await Deposit.find({ date: regex });

        const userStats = users.map(u => {
            const uidStr = u._id.toString();
            const userMeals = meals.filter(m => m.user_id.toString() === uidStr).reduce((sum, m) => sum + m.count, 0);
            const userDep = deposits.filter(d => d.user_id.toString() === uidStr).reduce((sum, d) => sum + d.amount, 0);
            
            const doc = u.toObject();
            doc.id = doc._id;
            return { ...doc, userMeals, userDep };
        });

        res.json({ success: true, data: userStats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/vouchers/:monthPrefix', async (req, res) => {
    try {
        const regex = new RegExp(`^${req.params.monthPrefix}`);
        const vouchers = await Voucher.find({ date: regex }).sort({ date: -1 });
        res.json({ success: true, data: vouchers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/deposits/:monthPrefix', async (req, res) => {
    try {
        const regex = new RegExp(`^${req.params.monthPrefix}`);
        const deposits = await Deposit.find({ date: regex }).populate('user_id', 'name').sort({ date: -1 });
        
        const mapped = deposits.map(d => {
            const doc = d.toObject();
            return {
                id: doc._id,
                date: doc.date,
                amount: doc.amount,
                name: doc.user_id ? doc.user_id.name : 'Unknown'
            };
        });

        res.json({ success: true, data: mapped });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
