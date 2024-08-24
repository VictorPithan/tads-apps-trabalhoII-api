import express from 'express';
import sqlite3 from 'sqlite3';
import pkg from 'jsonwebtoken';
const { verify, sign, decode } = pkg;

const db = new sqlite3.Database('./mydatabase.db');

db.run(`
    CREATE TABLE IF NOT EXISTS users (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       email TEXT,
       password TEXT
    )
 `);
 
 db.run(`
    CREATE TABLE IF NOT EXISTS posts (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       title TEXT,
       content TEXT,
       user_id INTEGER,
       FOREIGN KEY (user_id) REFERENCES users(id)
    )
 `);
const app = express();
app.use(express.json());

app.post('/api/users', (req, res) => {
   db.get('SELECT email FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
        return res.status(500).send('Error checking user');
    }

    if (row) {
        return res.status(409).send('Email already in use');
    }

    db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, password], (err) => {
        if (err) {
            return res.status(500).send('Error inserting user');
        }
        res.status(201).send('User inserted');
    });
});
});

app.get('/api/users', (req, res) => {
    db.all('SELECT email FROM users', (err, rows) => {
        if (err) {
            res.status(500).send('Error fetching users');
        } else {
            res.status(200).send(rows);
        }
    });
});

app.post('/api/auth', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT id, email FROM users WHERE email = ? AND password = ?', [email, password], (err, row) => {
        if (err) {
            res.status(500).send('Error authenticating user');
        } else if (row) {
            const token = sign({ 
                id: row.id,
                email: row.email
            }, 'secret');
            const user = { id: row.id, email: row.email }
            const data = {
                token,
                user
            }
            res.status(200).send(data);
        } else {
            res.status(401).send('User not authenticated');
        }
    });
});


const isAuthenticated = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (token) {
        const user = verify(token, 'secret');
        req.user = user;
        next()
    }
    else {
        res.status(401).send('User not authenticated');
    }
}


app.post('/api/posts', isAuthenticated, (req, res) => {
    const { title, content, user_id } = req.body;
    const user = req.user;
    db.run('INSERT INTO posts (title, content, user_id) VALUES (?, ?, ?)', [title, content, parseInt(user.id)], (err) => {
        if (err) {
            res.status(500).send('Error inserting post');
        } else {
            res.status(201).send('Post inserted');
        }
    });
});

app.get('/api/posts', isAuthenticated, (req, res) => {
    const { page = 1, limit = 5 } = req.query;
    const offset = (page - 1) * limit;

    db.get('SELECT COUNT(*) as count FROM posts', (err, row) => {
        if (err) {
            res.status(500).send('Error fetching count');
        } else {
            const totalItems = row.count;
            const totalPages = Math.ceil(totalItems / limit);
            const hasNext = page < totalPages;

            db.all(
                'SELECT posts.id, posts.title, posts.content, users.email FROM posts JOIN users ON posts.user_id = users.id ORDER BY posts.id DESC LIMIT ? OFFSET ?',
                [parseInt(limit), parseInt(offset)],
                (err, rows) => {
                    if (err) {
                        res.status(500).send('Error fetching posts');
                    } else {
                        res.status(200).json({
                            results: rows.length > 0 ? rows : [],
                            pages: totalPages,
                            next: hasNext,
                            count: totalItems
                        });
                    }
                }
            );
        }
    });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
