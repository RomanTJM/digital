import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './App.css';

const LIMIT = 20;
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  const [items, setItems] = useState([]);
  const [selection, setSelection] = useState([]);
  const [order, setOrder] = useState([]);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initLoaded, setInitLoaded] = useState(false);
  const loadedIds = useRef(new Set());
  const [isDragging, setIsDragging] = useState(false);

  // Загрузка состояния выбора и порядка
  useEffect(() => {
    axios.get(`${API_URL}/selection`).then(res => {
      setSelection(res.data.selection || []);
      setOrder(res.data.order || []);
      setSearch(res.data.search || '');
      setOffset(0);
      setItems([]);
      setHasMore(true);
      loadedIds.current = new Set();
      setInitLoaded(true);
    });
  }, []);

  // При смене поиска подгружаем соответствующие selection и order
  useEffect(() => {
    axios.get(`${API_URL}/selection`).then(res => {
      setSelection(res.data.selection || []);
      setOrder(res.data.order || []);
    });
    setItems([]);
    setOffset(0);
    setHasMore(true);
    loadedIds.current = new Set();
  }, [search]);

  // Сброс при поиске
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
    loadedIds.current = new Set();
    if (search === '') {
      setOrder([]); // сбрасываем порядок при сбросе поиска
    }
  }, [search]);

  // Подгрузка элементов
  useEffect(() => {
    if (!initLoaded) return;
    setLoading(true);

    if (search) {
      axios.get(`${API_URL}/items`, {
        params: { search, offset, limit: LIMIT }
      }).then(res => {
        setItems(prev => {
          if (offset === 0) return res.data.items;
          const prevSet = new Set(prev);
          return [...prev, ...res.data.items.filter(i => !prevSet.has(i))];
        });
        setHasMore(offset + LIMIT < res.data.total);
        setLoading(false);
      });
      return;
    }

    if (order.length > 0 && offset < order.length) {
      // Показываем только элементы из order
      const idsToShow = order.slice(offset, offset + LIMIT);
      axios.get(`${API_URL}/items`, {
        params: { ids: idsToShow.join(',') }
      }).then(res => {
        setItems(prev => {
          const prevSet = new Set(prev);
          return [...prev, ...res.data.items.filter(i => !prevSet.has(i))];
        });
        idsToShow.forEach(i => loadedIds.current.add(i));
        setHasMore(offset + LIMIT < order.length);
        setLoading(false);
      });
    } else if (order.length === 0) {
      // Если order пустой, сразу подгружаем из общего списка
      axios.get(`${API_URL}/items`, {
        params: { offset, limit: LIMIT }
      }).then(res => {
        setItems(prev => {
          const prevSet = new Set(prev);
          return [...prev, ...res.data.items.filter(i => !prevSet.has(i))];
        });
        setHasMore(res.data.items.length === LIMIT);
        setLoading(false);
      });
    } else {
      // После order подгружаем остальные элементы
      axios.get(`${API_URL}/items`, {
        params: { offset: offset - order.length, limit: LIMIT }
      }).then(res => {
        setItems(prev => {
          const prevSet = new Set(prev);
          return [...prev, ...res.data.items.filter(i => !prevSet.has(i))];
        });
        setHasMore(res.data.items.length === LIMIT);
        setLoading(false);
      });
    }
  }, [order, offset, search, initLoaded]);

  // Сохранение состояния
  useEffect(() => {
    axios.post(`${API_URL}/selection`, { selection, order, search });
  }, [selection, order, search]);

  // Drag&Drop обработчик
  const onDragStart = () => {
    setIsDragging(true);
  };
  const onDragEnd = (result) => {
    setIsDragging(false);
    if (!result.destination) return;
    const newItems = Array.from(items);
    const [removed] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, removed);

    if (!search && order.length > 0 && result.source.index < order.length && result.destination.index < order.length) {
      const newOrder = Array.from(order);
      const [removedOrder] = newOrder.splice(result.source.index, 1);
      newOrder.splice(result.destination.index, 0, removedOrder);
      setOrder(newOrder);
      setItems(newOrder.slice(0, items.length));
      setOffset(newOrder.length);
    } else {
      setOrder(newItems);
      setItems(newItems);
      setOffset(newItems.length);
    }
  };

  // Обработка выбора
  const toggleSelect = (item) => {
    setSelection(sel =>
      sel.includes(item) ? sel.filter(i => i !== item) : [...sel, item]
    );
  };

  // Подгрузка при скролле
  const handleScroll = (e) => {
    console.log('SCROLL', e.target.scrollTop, e.target.scrollHeight, e.target.clientHeight);
    if (
      hasMore &&
      !loading &&
      !isDragging &&
      e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 1
    ) {
      setOffset(o => o + LIMIT);
    }
  };

  return (
    <div className="app-scroll-container" onScroll={handleScroll}>
      <div className="input-wrapper">
        <input
          className="search-input"
          placeholder="Поиск..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <DragDropContext onDragEnd={onDragEnd} onDragStart={onDragStart}>
        <Droppable droppableId="list">
          {(provided) => (
            <table {...provided.droppableProps} ref={provided.innerRef} className="list-table">
              <tbody>
                {items.map((item, idx) => (
                  <Draggable key={item} draggableId={item.toString()} index={idx}>
                    {(provided) => (
                      <tr
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="list-row"
                        style={provided.draggableProps.style}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selection.includes(item)}
                            onChange={() => toggleSelect(item)}
                            className="checkbox"
                          />
                        </td>
                        <td>{item}</td>
                      </tr>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </tbody>
            </table>
          )}
        </Droppable>
      </DragDropContext>
      {loading && <div>Загрузка...</div>}
    </div>
  );
}

export default App;
