const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; script-src 'self'; img-src 'self' data:;"
  );
  next();
});

const ITEMS = Array.from({ length: 1_000_000 }, (_, i) => i + 1);
let userState = {
  selection: {}, 
  order: {},    
  search: ''
};

app.get('/items', (req, res) => {
  const { search = '', limit = 20, ids, exclude } = req.query;
  let filtered = ITEMS;

  if (ids) {
    const idsArr = ids.split(',').map(Number);
    filtered = idsArr;
  } else {
    if (search) {
      filtered = filtered.filter(num => num.toString().includes(search));
    }
    if (userState.order[search] && userState.order[search].length && !search) {
      filtered = [...userState.order[search], ...filtered.filter(i => !userState.order[search].includes(i))];
    }
    if (exclude) {
      const excludeArr = exclude.split(',').map(Number);
      filtered = filtered.filter(i => !excludeArr.includes(i));
      res.json({ items: filtered.slice(0, Number(limit)), total: filtered.length });
      return;
    }
  }
  const offset = Number(req.query.offset) || 0;
  const result = filtered.slice(offset, offset + Number(limit));
  res.json({ items: result, total: filtered.length });
});

app.post('/selection', (req, res) => {
  const { selection, order, search } = req.body;
  userState.selection[search] = selection;
  userState.order[search] = order;
  userState.search = search;
  res.json({ success: true });
});

app.get('/selection', (req, res) => {
  const search = userState.search || '';
  res.json({
    selection: userState.selection[search] || [],
    order: userState.order[search] || [],
    search
  });
});

app.get('/', (req, res) => {
  res.send('API is running');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 