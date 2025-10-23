const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.json());

let strings = {};

// Analyze function
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

// GET /strings - FIXED: Added query filtering
app.get('/strings', (req, res) => {
    try {
        let allStrings = Object.values(strings);
        
        // Apply filters
        if (req.query.is_palindrome !== undefined) {
            allStrings = allStrings.filter(s => 
                s.properties.is_palindrome === (req.query.is_palindrome === 'true')
            );
        }
        
        if (req.query.min_length !== undefined) {
            const minLen = parseInt(req.query.min_length);
            if (isNaN(minLen)) {
                return res.status(400).json({error: 'min_length must be a number'});
            }
            allStrings = allStrings.filter(s => s.properties.length >= minLen);
        }
        
        if (req.query.max_length !== undefined) {
            const maxLen = parseInt(req.query.max_length);
            if (isNaN(maxLen)) {
                return res.status(400).json({error: 'max_length must be a number'});
            }
            allStrings = allStrings.filter(s => s.properties.length <= maxLen);
        }
        
        if (req.query.word_count !== undefined) {
            const wordCount = parseInt(req.query.word_count);
            if (isNaN(wordCount)) {
                return res.status(400).json({error: 'word_count must be a number'});
            }
            allStrings = allStrings.filter(s => s.properties.word_count === wordCount);
        }
        
        if (req.query.contains_character !== undefined) {
            const char = req.query.contains_character;
            if (char.length !== 1) {
                return res.status(400).json({error: 'contains_character must be a single character'});
            }
            allStrings = allStrings.filter(s => s.value.includes(char));
        }
        
   
        const filtersApplied = {};
        if (req.query.is_palindrome !== undefined) filtersApplied.is_palindrome = req.query.is_palindrome;
        if (req.query.min_length !== undefined) filtersApplied.min_length = req.query.min_length;
        if (req.query.max_length !== undefined) filtersApplied.max_length = req.query.max_length;
        if (req.query.word_count !== undefined) filtersApplied.word_count = req.query.word_count;
        if (req.query.contains_character !== undefined) filtersApplied.contains_character = req.query.contains_character;
        
        res.json({
            data: allStrings,
            count: allStrings.length,
            filters_applied: filtersApplied
        });
        
    } catch (error) {
        res.status(500).json({error: 'Internal server error'});
    }
});

// GET /strings/filter-by-natural-language 

app.get('/strings/filter-by-natural-language', (req, res) => {
    try {
        const query = req.query.query;
        
        if (!query) {
            return res.status(400).json({error: 'Query parameter is required'});
        }
        
        const lowerQuery = query.toLowerCase();
        const filters = {};
        
        // Parse natural language
        if (lowerQuery.includes('palindrome')) {
            filters.is_palindrome = true;
        }
        
        if (lowerQuery.includes('single word')) {
            filters.word_count = 1;
        }
        
        const longerMatch = lowerQuery.match(/longer than (\d+)/);
        if (longerMatch) {
            filters.min_length = parseInt(longerMatch[1]) + 1;
        }
        
        const charMatch = lowerQuery.match(/contain[s]? [a-zA-Z]/) || lowerQuery.match(/with.*letter [a-zA-Z]/);
        if (charMatch) {
            const foundChar = lowerQuery.match(/[a-zA-Z](?=\s|$)/);
            if (foundChar) {
                filters.contains_character = foundChar[0];
            }
        }
        
        // Apply the parsed filters
        let filteredStrings = Object.values(strings);
        
        if (filters.is_palindrome !== undefined) {
            filteredStrings = filteredStrings.filter(s => s.properties.is_palindrome === filters.is_palindrome);
        }
        
        if (filters.word_count !== undefined) {
            filteredStrings = filteredStrings.filter(s => s.properties.word_count === filters.word_count);
        }
        
        if (filters.min_length !== undefined) {
            filteredStrings = filteredStrings.filter(s => s.properties.length >= filters.min_length);
        }
        
        if (filters.contains_character !== undefined) {
            filteredStrings = filteredStrings.filter(s => s.value.includes(filters.contains_character));
        }
        
        res.json({
            data: filteredStrings,
            count: filteredStrings.length,
            interpreted_query: {
                original: query,
                parsed_filters: filters
            }
        });
        
    } catch (error) {
        res.status(400).json({error: 'Unable to parse natural language query'});
    }
});

// DELETE /strings/:text 
app.delete('/strings/:text', (req, res) => {
    const text = req.params.text;
    
    if (!strings[text]) {
        return res.status(404).json({error: 'String not found'});
    }
    
    delete strings[text];
    res.status(204).send(); // No content
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});