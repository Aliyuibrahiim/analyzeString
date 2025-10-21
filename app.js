const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.json());

let strings = {};

// Analyze function - MUST include this
function analyzeString(text) {
    const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const words = text.trim().split(/\s+/).filter(w => w);
    const chars = [...text];
    const unique = new Set(chars).size;
    
    const freq = {};
    chars.forEach(c => freq[c] = (freq[c] || 0) + 1);
    
    const sha256 = crypto.createHash('sha256').update(text).digest('hex');
    
    return {
        length: text.length,
        is_palindrome: clean === clean.split('').reverse().join(''),
        unique_characters: unique,
        word_count: words.length,
        sha256_hash: sha256,
        character_frequency_map: freq
    };
}

// POST /strings
app.post('/strings', (req, res) => {
    try {
        const text = req.body.value;
        
        // Validation
        if (!text) return res.status(400).json({error: 'Need text'});
        if (typeof text !== 'string') return res.status(422).json({error: 'Must be string'});
        if (strings[text]) return res.status(409).json({error: 'Already exists'});
        
        // Analyze the string
        const properties = analyzeString(text);
        
        // Create response
        const data = {
            id: properties.sha256_hash,
            value: text,
            properties: properties,
            created_at: new Date().toISOString()
        };
        
        // Store it
        strings[text] = data;
        
        // Return response
        res.status(201).json(data);
        
    } catch (error) {
        res.status(500).json({error: 'Server error'});
    }
});

// GET /strings/:text
app.get('/strings/:text', (req, res) => {
    const data = strings[req.params.text];
    if (!data) return res.status(404).json({error: 'Not found'});
    res.json(data);
});

// Get all texts
app.get('/strings', (req, res) => {
    res.json(Object.values(strings));
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});