const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

class FirebaseLikeDatabase {
    constructor(config) {
        this.filePath = path.resolve(__dirname, config.filePath || 'database.json');
    }

    readData() {
        const data = fs.readFileSync(this.filePath);
        return JSON.parse(data);
    }

    writeData(data) {
        fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    }

    collection(collectionName) {
        const data = this.readData();
        return new CollectionReference(collectionName, data, this);
    }

    save(data) {
        this.writeData(data);
    }

    // Generate a custom user ID in AA12-BB43 format
    generateUserId() {
        const part1 = this.randomString(2) + this.randomNumber(2);
        const part2 = this.randomString(2) + this.randomNumber(2);
        return `${part1}-${part2}`;
    }

    // Helper function to generate a random string of uppercase letters
    randomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Helper function to generate a random string of numbers
    randomNumber(length) {
        const numbers = '0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += numbers.charAt(Math.floor(Math.random() * numbers.length));
        }
        return result;
    }

    // Register a new user with validators and custom user ID
    async registerUser(username, email, password) {
        // Validate username, email, and password
        this.validateUsername(username);
        this.validateEmail(email);
        this.validatePassword(password);

        const users = this.collection('users').get();
        if (Object.values(users).some(user => user.email === email)) {
            throw new Error('This email is already registered.');
        }

        const userId = this.generateUserId();
        const hashedPassword = await this.hashPassword(password);

        this.collection('users').add({
            id: userId,
            username,
            email,
            password: hashedPassword
        });

        return { id: userId, username, email };
    }

    // Login a user
    async loginUser(email, password) {
        const users = this.collection('users').get();
        const user = Object.values(users).find(user => user.email === email);

        if (!user) throw new Error('No user found with this email.');
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) throw new Error('Invalid password.');

        return { id: user.id, username: user.username, email: user.email };
    }

    // Hash password with bcrypt
    async hashPassword(password) {
        const saltRounds = 12; // Adjust as necessary (higher means more secure but slower)
        return await bcrypt.hash(password, saltRounds);
    }

    // Validate username
    validateUsername(username) {
        const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
        if (!usernameRegex.test(username)) {
            throw new Error('Username must be 3-30 characters long and can only contain letters, numbers, and underscores.');
        }
    }

    // Validate email
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format.');
        }
    }

    // Validate password
    validatePassword(password) {
        const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}$/;
        if (!passwordRegex.test(password)) {
            throw new Error('Password must be at least 8 characters long, contain at least one digit, one lowercase letter, one uppercase letter, and one special character.');
        }
    }
}

class CollectionReference {
    constructor(name, data, db) {
        this.name = name;
        this.data = data[name] || {};
        this.db = db;
    }

    get() {
        return this.data;
    }

    doc(docId) {
        return new DocumentReference(docId, this);
    }

    add(newDocument) {
        const newId = `doc${Date.now()}`;
        this.data[newId] = newDocument;
        this.db.save({ ...this.db.readData(), [this.name]: this.data });
        return { id: newId, data: newDocument };
    }
}

class DocumentReference {
    constructor(id, collectionRef) {
        this.id = id;
        this.collectionRef = collectionRef;
    }

    get() {
        return this.collectionRef.data[this.id];
    }

    set(data) {
        this.collectionRef.data[this.id] = data;
        this.collectionRef.db.save({
            ...this.collectionRef.db.readData(),
            [this.collectionRef.name]: this.collectionRef.data
        });
    }

    update(data) {
        this.collectionRef.data[this.id] = {
            ...this.collectionRef.data[this.id],
            ...data
        };
        this.collectionRef.db.save({
            ...this.collectionRef.db.readData(),
            [this.collectionRef.name]: this.collectionRef.data
        });
    }

    delete() {
        delete this.collectionRef.data[this.id];
        this.collectionRef.db.save({
            ...this.collectionRef.db.readData(),
            [this.collectionRef.name]: this.collectionRef.data
        });
    }
}

module.exports = FirebaseLikeDatabase;
