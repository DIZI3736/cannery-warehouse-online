import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('1234');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', quantity: '', categoryId: '', photoUrl: '' });
  const [loginError, setLoginError] = useState('');
  const [productError, setProductError] = useState('');
  const [editingErrorId, setEditingErrorId] = useState(null);

  const roleRu = (role) => {
    const roles = { 'STOREKEEPER': 'Кладовщик', 'SALES_MANAGER': 'Менеджер сбыта', 'ACCOUNTANT': 'Бухгалтер' };
    return roles[role] || role;
  };

  const authHeader = () => ({ headers: { Authorization: localStorage.getItem('token') } });

  const [loginLoading, setLoginLoading] = useState(false);

  const login = async (e, quickUser = null, quickPass = '1234') => {
    if (e) e.preventDefault();
    
    const finalUsername = (quickUser || username).trim().toLowerCase();
    const finalPassword = quickUser ? quickPass : password;

    if (!finalUsername) {
        setLoginError('Введите логин');
        return;
    }

    setLoginLoading(true);
    setLoginError('');
    
    console.log("Attempting login for:", finalUsername);
    
    // Proper way to handle UTF-8 in Basic Auth
    const token = 'Basic ' + btoa(encodeURIComponent(finalUsername + ':' + finalPassword).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1)));
    
    try {
      const res = await axios.get(API_URL + '/api/auth/me', { headers: { Authorization: token } });
      console.log("Login successful:", res.data);
      localStorage.setItem('token', token);
      setUser(res.data);
      fetchData(token);
    } catch (err) { 
        console.error("Login error details:", err);
        if (err.response && err.response.status === 401) {
            setLoginError('Неверный логин или пароль!');
        } else if (err.message === "Network Error") {
            setLoginError('Сервер недоступен (Network Error). Проверьте интернет или URL бэкенда.');
        } else {
            setLoginError('Ошибка входа: ' + (err.response?.data?.message || err.message));
        }
    } finally {
        setLoginLoading(false);
    }
  };

  const logout = () => { localStorage.removeItem('token'); setUser(null); setLoginError(''); setUsername(''); setPassword('1234'); };

  const fetchData = async (currentToken) => {
    const token = currentToken || localStorage.getItem('token');
    if (!token) return;
    const headers = { headers: { Authorization: token } };
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (search) params.append('name', search);
      
      const pRes = await axios.get(`${API_URL}/api/products?${params.toString()}`, headers);
      const sortedProducts = (pRes.data || []).sort((a, b) => a.id - b.id);
      setProducts(sortedProducts);
      const cRes = await axios.get(API_URL + '/api/categories', headers);
      setCategories(cRes.data || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
        axios.get(API_URL + '/api/auth/me', { headers: { Authorization: token } })
            .then(res => { setUser(res.data); })
            .catch(() => logout());
    }
  }, []);

  useEffect(() => {
    if (user) {
        const timer = setTimeout(() => fetchData(), 300);
        return () => clearTimeout(timer);
    }
  }, [selectedCategory, search, user]);

  const addProduct = async () => {
    setProductError('');
    if (!newProduct.name.trim()) return setProductError('Введите название товара!');
    if (!newProduct.categoryId) return setProductError('Выберите категорию!');
    if (newProduct.quantity === '' || parseInt(newProduct.quantity) < 0) return setProductError('Количество не может быть отрицательным!');

    try {
      await axios.post(API_URL + '/api/products', { ...newProduct, quantity: parseInt(newProduct.quantity), category: { id: parseInt(newProduct.categoryId) } }, authHeader());
      setNewProduct({ name: '', quantity: '', categoryId: '', photoUrl: '' });
      fetchData();
    } catch (err) { setProductError('Ошибка при сохранении'); }
  };

  const updateProduct = async (p) => {
      setProductError('');
      setEditingErrorId(null);
      if (p.quantity < 0) {
          setEditingErrorId(p.id);
          setProductError('Минус нельзя!');
          fetchData(); // Refresh to revert UI value
          return;
      }
      const catId = p.category?.id || p.categoryId;
      const productToSend = { ...p, category: { id: catId ? parseInt(catId) : null } };
      try {
          await axios.put(`${API_URL}/api/products/${p.id}`, productToSend, authHeader());
          fetchData();
      } catch (err) { 
          setEditingErrorId(p.id);
          setProductError('Ошибка'); 
          fetchData();
      }
  };

  const updatePrice = async (id, price) => {
      setProductError('');
      setEditingErrorId(null);
      const pVal = parseFloat(price);
      if (isNaN(pVal) || pVal < 0) {
          setEditingErrorId(id);
          setProductError('Минус нельзя!');
          return fetchData();
      }
      try {
          await axios.put(`${API_URL}/api/products/${id}/price`, { price: pVal }, authHeader());
          fetchData();
      } catch (err) { 
          setEditingErrorId(id);
          setProductError('Ошибка');
          fetchData();
      }
  };

  const deleteProduct = async (id) => {
      if (!window.confirm('Вы уверены, что хотите удалить этот товар?')) return;
      try {
          await axios.delete(`${API_URL}/api/products/${id}`, authHeader());
          fetchData();
      } catch (err) { setProductError('Ошибка при удалении'); }
  };

  const exportToExcel = async () => {
    try {
        const response = await axios.get(`${API_URL}/api/products/export`, {
            ...authHeader(),
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'products.xlsx');
        document.body.appendChild(link);
        link.click();
    } catch (err) { alert('Ошибка при экспорте'); }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
        await axios.post(`${API_URL}/api/products/import`, formData, {
            headers: { 
                ...authHeader().headers,
                'Content-Type': 'multipart/form-data'
            }
        });
        console.log('Данные успешно импортированы');
        fetchData();
    } catch (err) { console.error('Ошибка при импорте'); }
  };

  const uploadPhoto = async (e, p = null) => {
      const file = e.target.files[0];
      if (!file) return;
      console.log("Uploading file:", file.name, "size:", file.size);
      const formData = new FormData();
      formData.append('file', file);
      try {
          const res = await axios.post(`${API_URL}/api/products/upload`, formData, {
              headers: { ...authHeader().headers, 'Content-Type': 'multipart/form-data' }
          });
          console.log("Upload success, path:", res.data);
          const photoUrl = API_URL + res.data;
          if (p) {
              updateProduct({ ...p, photoUrl });
          } else {
              setNewProduct({ ...newProduct, photoUrl });
          }
      } catch (err) { 
          console.error("Full upload error:", err);
          let msg = "Неизвестная ошибка";
          if (err.response) {
              msg = `Сервер ответил ошибкой ${err.response.status}: ${JSON.stringify(err.response.data)}`;
          } else if (err.request) {
              msg = "Сервер не ответил. Проверьте, запущен ли бэкенд на порту 8080.";
          } else {
              msg = err.message;
          }
          alert('Ошибка загрузки фото: ' + msg); 
      }
  };

  // --- ИЗЮМИНКИ (ЛОГИКА) ---
  const getDeficitItems = () => products.filter(p => p.quantity < 200);
  const getTotalValue = () => products.reduce((sum, p) => sum + (p.price * p.quantity || 0), 0);
  const getCategoryStats = () => {
      const stats = {};
      products.forEach(p => {
          stats[p.categoryName] = (stats[p.categoryName] || 0) + p.quantity;
      });
      const total = products.reduce((sum, p) => sum + p.quantity, 0);
      return Object.entries(stats).map(([name, qty]) => ({ name, percent: Math.round((qty/total)*100) }));
  };

  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card animate-in">
          <div className="text-center mb-5">
             <h1 className="fw-extrabold text-dark">CANNERY ERP</h1>
             <p className="text-muted small">Система управления складом консервного завода</p>
          </div>
          <form onSubmit={login}>
            <div className="mb-3"><label className="small fw-bold text-secondary">ЛОГИН</label><input className="form-control rounded-3" value={username} onChange={e => {setUsername(e.target.value); setLoginError('');}} /></div>
            <div className="mb-4"><label className="small fw-bold text-secondary">ПАРОЛЬ</label><input className="form-control rounded-3" type="password" value={password} onChange={e => {setPassword(e.target.value); setLoginError('');}} /></div>
            
            {loginError && (
              <div className="alert alert-danger py-2 small fw-bold text-center mb-3 rounded-3" style={{fontSize: '0.85rem'}}>
                ⚠️ {loginError}
              </div>
            )}
            
            <button className="btn btn-primary btn-lg w-100 rounded-3 shadow-sm fw-bold" disabled={loginLoading}>
                {loginLoading ? 'ВХОД...' : 'ВОЙТИ'}
            </button>
          </form>
          <div className="mt-5 pt-4 border-top">
             <div className="row g-2">
                <div className="col-12"><button className="btn btn-outline-success w-100 fw-bold" onClick={() => {setUsername('storekeeper'); setPassword('1234'); setLoginError('');}}>ЗАПОЛНИТЬ: КЛАДОВЩИК</button></div>
                <div className="col-12"><button className="btn btn-outline-primary w-100 fw-bold" onClick={() => {setUsername('manager'); setPassword('1234'); setLoginError('');}}>ЗАПОЛНИТЬ: МЕНЕДЖЕР</button></div>
                <div className="col-12"><button className="btn btn-outline-info w-100 fw-bold" onClick={() => {setUsername('accountant'); setPassword('1234'); setLoginError('');}}>ЗАПОЛНИТЬ: БУХГАЛТЕР</button></div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper min-vh-100">
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow sticky-top py-2 py-md-3">
        <div className="container">
          <span className="navbar-brand fw-bold fs-5 fs-md-4">🏭 FishERP 2.0</span>
          <div className="d-flex align-items-center gap-2 gap-md-3 ms-auto">
             <span className="badge bg-primary p-2 px-2 px-md-4 rounded-3 d-none d-sm-inline-block">{roleRu(user.role)}: {user.fullName}</span>
             <button className="btn btn-danger btn-sm btn-md px-3 px-md-4 rounded-3 fw-bold" onClick={logout}>ВЫХОД</button>
          </div>
        </div>
      </nav>

      <div className="container mt-3 mt-md-4 pb-5">
        
        {/* РАЗДЕЛ "ИЗЮМИНКИ" */}
        <div className="row mb-3 mb-md-4">
            {user.role === 'STOREKEEPER' && getDeficitItems().length > 0 && (
                <div className="col-12 animate-in mb-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white border-start border-danger border-5">
                        <h6 className="fw-bold text-danger mb-3">⚡ Срочно к пополнению (Дефицит менее 200 шт)</h6>
                        <div className="d-flex flex-wrap gap-2">
                            {getDeficitItems().map(p => (
                                <span key={p.id} className="badge bg-danger-subtle text-danger p-2 px-3 rounded-pill" style={{fontSize: '0.8rem'}}>
                                    {p.name}: <strong>{p.quantity} шт.</strong>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {user.role === 'STOREKEEPER' && getDeficitItems().length === 0 && (
                <div className="col-12 animate-in mb-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white border-start border-success border-5">
                        <div className="d-flex align-items-center text-success fw-bold small">
                            <span className="fs-5 me-2">✅</span> Склад укомплектован: дефицитных позиций нет
                        </div>
                    </div>
                </div>
            )}
            {user.role === 'ACCOUNTANT' && (
                <div className="col-12 animate-in mb-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-primary text-white">
                        <div className="row align-items-center text-center text-md-start">
                            <div className="col-md-8">
                                <h6 className="fw-bold mb-1">📊 Оценка товарных запасов</h6>
                                <p className="opacity-75 mb-2 mb-md-0 small">Суммарная балансовая стоимость ТМЦ на складе завода</p>
                            </div>
                            <div className="col-md-4 text-md-end">
                                <h3 className="fw-extrabold mb-0">{getTotalValue().toLocaleString()} ₽</h3>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {user.role === 'SALES_MANAGER' && (
                <div className="col-12 animate-in mb-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white">
                        <h6 className="fw-bold mb-3">📈 Структура складских запасов</h6>
                        <div className="row">
                            {getCategoryStats().map(s => (
                                <div key={s.name} className="col-md-4 col-12 mb-3">
                                    <div className="small fw-bold text-muted mb-1">{s.name}</div>
                                    <div className="progress" style={{height: '8px'}}>
                                        <div className="progress-bar bg-primary" style={{width: `${s.percent}%`}}></div>
                                    </div>
                                    <div className="text-end small fw-bold mt-1">{s.percent}%</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* ОСНОВНОЙ ФУНКЦИОНАЛ */}
        {user.role === 'STOREKEEPER' && (
            <div className="card p-3 p-md-4 shadow-sm border-0 rounded-4 mb-3 mb-md-4 bg-white">
                <h6 className="fw-bold text-muted text-uppercase mb-3 small">Приемка новой партии товара</h6>
                <div className="row g-2 g-md-3 mb-2 align-items-center">
                    <div className="col-12 col-md-3">
                        <input className="form-control bg-light border-0" placeholder="Наименование товара" value={newProduct.name} onChange={e=>{setNewProduct({...newProduct, name: e.target.value}); setProductError('');}} />
                    </div>
                    <div className="col-6 col-md-2">
                        <select className="form-select bg-light border-0" value={newProduct.categoryId} onChange={e=>{setNewProduct({...newProduct, categoryId: e.target.value}); setProductError('');}}>
                            <option value="">Категория...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="col-6 col-md-2">
                        <input type="number" min="0" className="form-control bg-light border-0" placeholder="Кол-во" value={newProduct.quantity} onChange={e=>{setNewProduct({...newProduct, quantity: e.target.value}); setProductError('');}} />
                    </div>
                    <div className="col-12 col-md-3">
                        <div className="d-flex align-items-center gap-2">
                            {newProduct.photoUrl && (
                                <img src={newProduct.photoUrl} className="rounded-2 shadow-sm border" style={{width: '38px', height: '38px', objectFit: 'cover'}} 
                                     onError={(e) => e.target.style.display = 'none'} 
                                     onLoad={(e) => e.target.style.display = 'block'} />
                            )}
                            <div className="input-group bg-light rounded-3 overflow-hidden">
                                <input className="form-control border-0 bg-transparent" placeholder="Ссылка или файл..." value={newProduct.photoUrl} onChange={e=>{setNewProduct({...newProduct, photoUrl: e.target.value}); setProductError('');}} />
                                <label className="btn btn-light border-0 d-flex align-items-center px-2" title="Загрузить файл с диска">
                                    📁<input type="file" hidden accept="image/*" onChange={(e) => uploadPhoto(e)} />
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-md-2">
                        <button className="btn btn-dark w-100 fw-bold py-2 shadow-sm" onClick={addProduct}>ПРИНЯТЬ</button>
                    </div>
                </div>
                {productError && !editingErrorId && <div className="text-danger small fw-bold mt-2 animate-in">⚠️ {productError}</div>}
            </div>
        )}

        <div className="card shadow-sm p-3 p-md-4 mb-3 mb-md-4 border-0 rounded-4 bg-white d-flex flex-column flex-md-row align-items-center gap-2 gap-md-3">
            <input className="form-control rounded-pill px-4 bg-light border-0" placeholder="🔍 Поиск по реестру..." onChange={e => setSearch(e.target.value)} />
            <div className="w-100 d-flex gap-2">
                <select className="form-select rounded-pill bg-light border-0" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                    <option value="">Все категории</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="d-flex gap-1 gap-md-2">
                    <button className="btn btn-outline-success rounded-pill px-2 px-md-3 fw-bold small-btn" onClick={exportToExcel} title="Экспорт в Excel">
                        📥 <span className="d-none d-sm-inline">ЭКСПОРТ</span>
                    </button>
                    <label className="btn btn-outline-primary rounded-pill px-2 px-md-3 fw-bold mb-0 small-btn" style={{ cursor: 'pointer' }} title="Импорт из Excel">
                        📤 <span className="d-none d-sm-inline">ИМПОРТ</span>
                        <input 
                            type="file" 
                            style={{ display: 'none' }} 
                            accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                            onChange={handleImport} 
                        />
                    </label>
                </div>
            </div>
        </div>

        <div className="table-responsive animate-in">
            <table className="table modern-table align-middle">
                <thead>
                    <tr>
                        <th style={{width: '60px'}} className="d-none d-md-table-cell">Фото</th>
                        <th>Наименование</th>
                        <th style={{width: '140px'}} className="d-none d-md-table-cell">Категория</th>
                        <th style={{width: '100px'}}>Остаток</th>
                        {user.role !== 'STOREKEEPER' && <th style={{width: '120px'}}>Цена</th>}
                        <th className="text-end pe-4" style={{width: '100px'}}>Опц.</th>
                    </tr>
                </thead>
                <tbody>
                    {products.map(p => (
                        <tr key={p.id}>
                            <td className="d-none d-md-table-cell"><div className="product-img-container"><img src={p.photoUrl} className="product-img" onError={e=>e.target.src='https://cdn-icons-png.flaticon.com/512/1170/1170628.png'}/></div></td>
                            <td>
                                {user.role === 'STOREKEEPER' ? (
                                    <input className="form-control form-control-sm border-0 bg-transparent fw-bold p-0 text-primary" defaultValue={p.name} onBlur={(e)=>updateProduct({...p, name: e.target.value})} />
                                ) : <div className="fw-bold text-truncate" style={{maxWidth: '150px'}}>{p.name}</div>}
                                <div className="d-md-none small text-muted text-truncate" style={{maxWidth: '150px'}}>{p.categoryName}</div>
                            </td>
                            <td className="d-none d-md-table-cell">
                                {user.role === 'STOREKEEPER' ? (
                                    <select className="form-select form-select-sm border-0 bg-light" value={p.categoryId || ''} onChange={(e)=>updateProduct({...p, category: {id: e.target.value}})}>
                                        <option value="" disabled>Выбор...</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                ) : <span className="badge bg-light text-dark fw-normal">{p.categoryName}</span>}
                            </td>
                            <td>
                                {user.role === 'STOREKEEPER' ? (
                                    <>
                                        <input type="number" min="0" className={`form-control form-control-sm w-100 border-0 bg-light fw-bold ${editingErrorId === p.id ? 'is-invalid' : ''}`} 
                                            defaultValue={p.quantity} 
                                            onFocus={() => {setEditingErrorId(null); setProductError('');}}
                                            onBlur={(e)=>updateProduct({...p, quantity: parseInt(e.target.value)})} />
                                        {editingErrorId === p.id && <div className="text-danger small fw-bold" style={{fontSize: '0.65rem'}}>⚠️</div>}
                                    </>
                                ) : (
                                    <span className={`badge-custom ${p.quantity < 200 ? 'bg-critical' : 'bg-ok'}`}>
                                        {p.quantity}
                                    </span>
                                )}
                            </td>
                            {user.role !== 'STOREKEEPER' && (
                                <td>
                                    {user.role === 'ACCOUNTANT' ? (
                                        <>
                                            <input type="number" min="0" className={`form-control form-control-sm border-primary bg-white fw-bold text-primary ${editingErrorId === p.id ? 'is-invalid' : ''}`} defaultValue={p.price} onFocus={() => {setEditingErrorId(null); setProductError('');}}
                                                onBlur={(e)=>updatePrice(p.id, e.target.value)} />
                                        </>
                                    ) : <span className="fw-bold">{p.price}</span>}
                                </td>
                            )}
                            <td className="text-end pe-2 pe-md-4">
                                {user.role === 'STOREKEEPER' ? (
                                    <div className="d-flex gap-1 justify-content-end align-items-center">
                                        <label className="btn btn-xs btn-light rounded-circle mb-0" title="Загрузить фото" style={{padding: '2px 5px', fontSize: '10px'}}>
                                            📁<input type="file" hidden accept="image/*" onChange={(e) => uploadPhoto(e, p)} />
                                        </label>
                                        <button className="btn btn-xs btn-outline-danger rounded-circle" title="Удалить" style={{padding: '2px 5px', fontSize: '10px'}} onClick={() => deleteProduct(p.id)}>🗑️</button>
                                    </div>
                                ) : <span className="text-muted small">🔒</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}

export default App;

