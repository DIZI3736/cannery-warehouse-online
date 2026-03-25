import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';
const FALLBACK_IMAGE = 'https://cdn-icons-png.flaticon.com/512/1170/1170628.png';
const EMPTY_PRODUCT_STATS = { deficitItems: [], totalValue: 0, categoryStats: [] };

function DeleteDialog({ product, loading, onCancel, onConfirm }) {
  if (!product) return null;

  return (
    <div className="app-modal-backdrop" onClick={loading ? undefined : onCancel}>
      <div className="app-modal animate-in" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-header">
          <div>
            <div className="app-modal-kicker">Подтверждение</div>
            <h5 className="app-modal-title">Удалить товар?</h5>
          </div>
          <button type="button" className="btn-close" onClick={onCancel} disabled={loading} />
        </div>
        <p className="app-modal-text">
          Вы действительно хотите удалить <strong>{product.name}</strong>?
        </p>
        <div className="app-modal-actions">
          <button type="button" className="btn btn-light" onClick={onCancel} disabled={loading}>
            Отмена
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Удаление...' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoLinkDialog({ open, value, error, onChange, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="app-modal-backdrop" onClick={onCancel}>
      <div className="app-modal animate-in" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-header">
          <div>
            <div className="app-modal-kicker">Фото товара</div>
            <h5 className="app-modal-title">Ссылка на изображение</h5>
          </div>
          <button type="button" className="btn-close" onClick={onCancel} />
        </div>
        <p className="app-modal-text">
          Вставьте прямую ссылку на фото товара. После сохранения изображение появится в списке.
        </p>
        <input
          type="url"
          className="form-control app-modal-input"
          placeholder="https://example.com/photo.jpg"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoFocus
        />
        {error && <div className="app-modal-error">{error}</div>}
        <div className="app-modal-actions">
          <button type="button" className="btn btn-light" onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

function AppToast({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="app-toast-wrap" aria-live="assertive" aria-atomic="true">
      <div className="app-toast animate-in" role="alert">
        <div className="app-toast-accent" aria-hidden="true">!</div>
        <div className="app-toast-content">
          <div className="app-toast-title">Проверьте данные</div>
          <div className="app-toast-message">{message}</div>
        </div>
        <button
          type="button"
          className="app-toast-close"
          aria-label="Закрыть уведомление"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}

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
  const [productStats, setProductStats] = useState(EMPTY_PRODUCT_STATS);
  const [editingErrorId, setEditingErrorId] = useState(null);
  const [editingErrorField, setEditingErrorField] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [photoDialog, setPhotoDialog] = useState({ open: false, product: null, value: '', error: '' });
  
  // Реф нужен, чтобы setInterval всегда видел актуальное состояние редактирования
  const isEditingRef = useRef(false);
  useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);
  useEffect(() => {
    if (!deleteCandidate) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !deleteLoading) {
        setDeleteCandidate(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteCandidate, deleteLoading]);

  useEffect(() => {
    if (!photoDialog.open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPhotoDialog({ open: false, product: null, value: '', error: '' });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [photoDialog.open]);

  useEffect(() => {
    const shouldLockScroll = Boolean(deleteCandidate) || photoDialog.open;
    document.body.classList.toggle('app-modal-open', shouldLockScroll);

    return () => {
      document.body.classList.remove('app-modal-open');
    };
  }, [deleteCandidate, photoDialog.open]);

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
    
    // Proper way to handle UTF-8 in Basic Auth
    const token = 'Basic ' + btoa(encodeURIComponent(finalUsername + ':' + finalPassword).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1)));
    
    try {
      const res = await axios.get(API_URL + '/api/auth/me', { headers: { Authorization: token } });
      localStorage.setItem('token', token);
      setUser(res.data);
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

  const buildFilterQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedCategory) params.append('categoryId', selectedCategory);
    if (search.trim()) params.append('name', search.trim());
    return params.toString();
  }, [selectedCategory, search]);

  const normalizeProductStats = (data) => ({
    deficitItems: data?.deficitItems || [],
    totalValue: Number(data?.totalValue || 0),
    categoryStats: data?.categoryStats || []
  });

  const buildFallbackProductStats = useCallback((items) => {
    const safeItems = items || [];
    const deficitItems = safeItems
      .filter((item) => Number(item?.quantity ?? 0) < 200)
      .map((item) => ({
        id: item.id,
        name: item.name,
        quantity: Number(item?.quantity ?? 0)
      }));

    const totalValue = safeItems.reduce((sum, item) => {
      const price = Number(item?.price ?? 0);
      const quantity = Number(item?.quantity ?? 0);
      return sum + (price * quantity);
    }, 0);

    const categoryTotals = {};
    let totalQuantity = 0;
    safeItems.forEach((item) => {
      const categoryName = item?.categoryName ?? 'undefined';
      const quantity = Number(item?.quantity ?? 0);
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + quantity;
      totalQuantity += quantity;
    });

    const categoryStats = Object.entries(categoryTotals).map(([name, quantity]) => ({
      name,
      percent: totalQuantity ? Math.round((quantity / totalQuantity) * 100) : 0
    }));

    return { deficitItems, totalValue, categoryStats };
  }, []);

  const applyProductStats = useCallback((nextStats, ignoreEditingGuard = false) => {
    setProductStats(prev => {
        if (!ignoreEditingGuard && isEditingRef.current) return prev;
        if (JSON.stringify(prev) !== JSON.stringify(nextStats)) {
            return nextStats;
        }
        return prev;
    });
  }, []);

  const fetchProductStats = useCallback(async (currentToken, ignoreEditingGuard = false, fallbackProducts = []) => {
    const token = currentToken || localStorage.getItem('token');
    if (!token) return;

    const headers = { headers: { Authorization: token } };
    const query = buildFilterQueryString();
    const cacheBuster = `_ts=${Date.now()}`;
    const url = `${API_URL}/api/products/stats?${query ? `${query}&${cacheBuster}` : cacheBuster}`;

    try {
      const statsRes = await axios.get(url, headers);
      applyProductStats(normalizeProductStats(statsRes.data), ignoreEditingGuard);
    } catch (err) {
      applyProductStats(buildFallbackProductStats(fallbackProducts), ignoreEditingGuard);
    }
  }, [applyProductStats, buildFallbackProductStats, buildFilterQueryString]);

  const fetchData = useCallback(async (currentToken) => {
    const token = currentToken || localStorage.getItem('token');
    if (!token) return;
    const headers = { headers: { Authorization: token } };
    try {
      const query = buildFilterQueryString();
      const cacheBuster = `_ts=${Date.now()}`;
      const suffix = query ? `?${query}&${cacheBuster}` : `?${cacheBuster}`;
      const [pRes, cRes] = await Promise.all([
          axios.get(`${API_URL}/api/products${suffix}`, headers),
          axios.get(`${API_URL}/api/categories?${cacheBuster}`, headers)
      ]);
      const sortedProducts = (pRes.data || []).sort((a, b) => a.id - b.id);
      
      setProducts(prev => {
          // Если пользователь редактирует, НЕ обновляем список извне, чтобы не затереть ввод
          if (isEditingRef.current) return prev; 
          if (JSON.stringify(prev) !== JSON.stringify(sortedProducts)) {
              return sortedProducts;
          }
          return prev;
      });

      setCategories(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(cRes.data)) {
              return cRes.data;
          }
          return prev;
      });
      fetchProductStats(token, false, sortedProducts);
    } catch (err) { console.error(err); }
  }, [buildFilterQueryString, fetchProductStats]); // Зависимости важны для актуальных данных в поиске

  // Первоначальная загрузка и обновление при поиске/фильтрации
  useEffect(() => {
    if (user) {
        fetchData();
    }
  }, [user, fetchData]);

  // Интервал автоматического обновления (1 секунда)
  useEffect(() => {
    if (user) {
        const interval = setInterval(() => {
            fetchData();
        }, 1000); 
        return () => clearInterval(interval);
    }
  }, [user, fetchData]);

  // Браузер может замедлять таймеры в фоновой вкладке, поэтому обновляемся сразу при возврате.
  useEffect(() => {
    if (!user) return undefined;

    const syncOnReturn = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };

    window.addEventListener('focus', syncOnReturn);
    document.addEventListener('visibilitychange', syncOnReturn);

    return () => {
      window.removeEventListener('focus', syncOnReturn);
      document.removeEventListener('visibilitychange', syncOnReturn);
    };
  }, [user, fetchData]);

  const beginEditing = () => {
      isEditingRef.current = true;
      setIsEditing(true);
  };

  const endEditing = () => {
      isEditingRef.current = false;
      setIsEditing(false);
  };

  const endEditingLater = () => {
      setTimeout(() => {
          isEditingRef.current = false;
          setIsEditing(false);
      }, 1000);
  };

  const getApiErrorMessage = (err, fallback) => {
      const data = err?.response?.data;
      if (typeof data === 'string' && data.trim()) return data;
      if (data?.message) return data.message;
      return fallback;
  };

  const clearEditingError = () => {
      setEditingErrorId(null);
      setEditingErrorField('');
      setProductError('');
  };

  const resetEditingWithError = (message, errorId = null, errorField = '') => {
      setEditingErrorId(errorId);
      setEditingErrorField(errorField);
      setProductError(message);
      endEditing();
      fetchData();
  };

  const showEditingValidationError = (message, errorId = null, errorField = '') => {
      setEditingErrorId(errorId);
      setEditingErrorField(errorField);
      setProductError(message);
      beginEditing();
  };

  const getEditingErrorMessage = (productId, field) => (
      editingErrorId === productId && editingErrorField === field ? productError : ''
  );

  const normalizeProductName = (value = '') => {
      if (!value) return '';
      const trimmedStart = value.replace(/^\s+/, '');
      if (!trimmedStart) return '';
      return trimmedStart.charAt(0).toLocaleUpperCase('ru-RU') + trimmedStart.slice(1);
  };

  const addProduct = async () => {
    setProductError('');
    const normalizedName = normalizeProductName(newProduct.name);
    if (!normalizedName.trim()) return setProductError('Введите название товара!');
    if (!newProduct.categoryId) return setProductError('Выберите категорию!');
    if (newProduct.quantity === '') return setProductError('Введите количество!');
    if (parseInt(newProduct.quantity) < 0) return setProductError('Количество не может быть отрицательным!');

    try {
      await axios.post(API_URL + '/api/products', { ...newProduct, name: normalizedName, quantity: parseInt(newProduct.quantity), category: { id: parseInt(newProduct.categoryId) } }, authHeader());
      setNewProduct({ name: '', quantity: '', categoryId: '', photoUrl: '' });
      fetchData();
    } catch (err) { setProductError(getApiErrorMessage(err, 'Ошибка при сохранении')); }
  };

  const updateProduct = async (p, editedField = '') => {
      const trimmedName = normalizeProductName(p.name);
      if (!trimmedName) {
          showEditingValidationError('Название товара обязательно', p.id, 'name');
          return;
      }

      if (p.quantity === "" || p.quantity === null || p.quantity === undefined) {
          showEditingValidationError('Введите количество!', p.id, 'quantity');
          return; 
      }

      clearEditingError();
      beginEditing(); 

      let qVal = parseInt(p.quantity);
      
      if (isNaN(qVal) || qVal < 0) {
          showEditingValidationError(qVal < 0 ? 'Минус нельзя!' : 'Введите число!', p.id, 'quantity');
          return;
      }
      
      const catId = p.category?.id || p.categoryId;
      const nextProducts = products.map(item => item.id === p.id ? { ...p, name: trimmedName, quantity: qVal, categoryId: catId } : item);
      setProducts(nextProducts);

      const productToSend = { 
          ...p, 
          name: trimmedName,
          quantity: qVal, 
          category: (catId && catId !== "") ? { id: parseInt(catId) } : null 
      };

      try {
          await axios.put(`${API_URL}/api/products/${p.id}`, productToSend, authHeader());
          fetchProductStats(null, true, nextProducts);
          endEditingLater();
      } catch (err) { 
          resetEditingWithError(getApiErrorMessage(err, 'Ошибка сохранения'), p.id, editedField);
      }
  };

  const updatePrice = async (id, price) => {
      if (price === "" || price === null || price === undefined) {
          showEditingValidationError('Введите цену!', id, 'price');
          return;
      }

      clearEditingError();
      beginEditing();

      let pVal = parseFloat(price);
      if (isNaN(pVal) || pVal < 0) {
          showEditingValidationError(pVal < 0 ? 'Минус нельзя!' : 'Введите число!', id, 'price');
          return;
      }

      const nextProducts = products.map(item => item.id === id ? { ...item, price: pVal } : item);
      setProducts(nextProducts);

      try {
          await axios.put(`${API_URL}/api/products/${id}/price`, { price: pVal }, authHeader());
          fetchProductStats(null, true, nextProducts);
          endEditingLater();
      } catch (err) { 
          resetEditingWithError(getApiErrorMessage(err, 'Ошибка сохранения цены'), id, 'price');
      }
  };

  const requestDeleteProduct = (product) => {
      setDeleteCandidate(product);
  };

  const closeDeleteModal = () => {
      if (deleteLoading) return;
      setDeleteCandidate(null);
  };

  const deleteProduct = async () => {
      if (!deleteCandidate) return;

      setDeleteLoading(true);
      try {
          await axios.delete(`${API_URL}/api/products/${deleteCandidate.id}`, authHeader());
          setDeleteCandidate(null);
          fetchData();
      } catch (err) {
          setProductError('Ошибка при удалении');
      } finally {
          setDeleteLoading(false);
      }
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
    } catch (err) { setProductError('Ошибка при экспорте'); }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProductError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
        await axios.post(`${API_URL}/api/products/import`, formData, {
            headers: { 
                ...authHeader().headers,
                'Content-Type': 'multipart/form-data'
            }
        });
        fetchData();
        e.target.value = '';
    } catch (err) { 
        console.error('Ошибка при импорте:', err);
        let msg = 'Ошибка при импорте. Проверьте структуру файла.';
        if (err.response && err.response.data) {
            if (typeof err.response.data === 'string') {
                msg = err.response.data;
            } else if (err.response.data.message) {
                msg = err.response.data.message;
            } else {
                msg = JSON.stringify(err.response.data);
            }
        }
        setProductError(msg);
        e.target.value = '';
    }
  };

  const uploadPhoto = async (e, p = null) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
          const res = await axios.post(`${API_URL}/api/products/upload`, formData, {
              headers: { ...authHeader().headers, 'Content-Type': 'multipart/form-data' }
          });
          const photoUrl = API_URL + res.data;
          if (p) {
              updateProduct({ ...p, photoUrl }, 'photoUrl');
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
          setProductError('Ошибка загрузки фото: ' + msg); 
      }
  };

  const getProductCategoryId = (product) => product.category?.id || product.categoryId || '';
  const setLocalProductState = (id, patch) => {
      setProducts(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  };
  const openPhotoLinkDialog = (product = null) => {
      setPhotoDialog({
          open: true,
          product,
          value: product?.photoUrl || newProduct.photoUrl || '',
          error: ''
      });
  };
  const closePhotoLinkDialog = () => {
      setPhotoDialog({ open: false, product: null, value: '', error: '' });
  };
  const savePhotoLink = () => {
      const normalizedUrl = photoDialog.value.trim();
      if (!normalizedUrl) {
          setPhotoDialog(prev => ({ ...prev, error: 'Введите ссылку на фото' }));
          return;
      }

      if (photoDialog.product) {
          updateProduct({ ...photoDialog.product, photoUrl: normalizedUrl }, 'photoUrl');
      } else {
          setNewProduct(prev => ({ ...prev, photoUrl: normalizedUrl }));
          setProductError('');
      }

      closePhotoLinkDialog();
  };

  const totalQuantity = products.reduce((sum, item) => sum + Number(item?.quantity ?? 0), 0);
  const currentRole = user?.role || '';
  const roleVisualTitle = {
      STOREKEEPER: 'Живой реестр склада',
      ACCOUNTANT: 'Финансовый срез остатков',
      SALES_MANAGER: 'Каталог для контроля отгрузок'
  };
  const roleVisualDescription = {
      STOREKEEPER: 'Контроль приемки, дефицита и карточек товаров в одном экране.',
      ACCOUNTANT: 'Стоимость, остатки и цены собраны в одном рабочем представлении.',
      SALES_MANAGER: 'Структура ассортимента и доступные позиции для планирования продаж.'
  };

  const getCategoryTone = (categoryName = '') => {
      const normalized = categoryName.toLowerCase();
      if (normalized.includes('масл')) return 'category-pill-oil';
      if (normalized.includes('томат')) return 'category-pill-tomato';
      if (normalized.includes('натурал')) return 'category-pill-natural';
      if (normalized.includes('паштет')) return 'category-pill-pate';
      return 'category-pill-default';
  };

  const renderCategoryBadge = (categoryName) => (
      <span className={`category-pill ${getCategoryTone(categoryName)}`}>
          {categoryName || 'Без категории'}
      </span>
  );

  const overviewCards = [
      {
          label: 'Позиций в каталоге',
          value: products.length,
          tone: 'overview-card-neutral'
      },
      {
          label: 'Товаров на складе',
          value: `${totalQuantity.toLocaleString()} шт.`,
          tone: 'overview-card-primary'
      },
      currentRole === 'STOREKEEPER'
          ? {
              label: 'Дефицитных позиций',
              value: productStats.deficitItems.length,
              tone: productStats.deficitItems.length ? 'overview-card-danger' : 'overview-card-success'
          }
          : currentRole === 'ACCOUNTANT'
              ? {
                  label: 'Стоимость запасов',
                  value: `${Number(productStats.totalValue || 0).toLocaleString()} ₽`,
                  tone: 'overview-card-accent'
              }
              : {
                  label: 'Категорий в реестре',
                  value: categories.length,
                  tone: 'overview-card-info'
              }
  ];

  const renderEmptyState = () => (
      <div className="catalog-empty animate-in">
          <div className="catalog-empty-icon">📦</div>
          <h5 className="catalog-empty-title">Список товаров пока пуст</h5>
          <p className="catalog-empty-text">
              Измените фильтр, очистите поиск или добавьте новую позицию через приемку и импорт.
          </p>
      </div>
  );

  const renderStorekeeperActions = (product, mobile = false) => (
      <div className={mobile ? "mobile-product-actions" : "d-flex gap-1 justify-content-end align-items-center"}>
          <button
              className={mobile ? "btn btn-light mobile-action-btn" : "btn btn-xs btn-light rounded-circle"}
              onClick={() => openPhotoLinkDialog(product)}
              title="Добавить по ссылке"
              style={mobile ? undefined : {padding: '2px 5px', fontSize: '10px'}}
          >
              {mobile ? 'Ссылка' : '🔗'}
          </button>
          <label
              className={mobile ? "btn btn-light mobile-action-btn mb-0" : "btn btn-xs btn-light rounded-circle mb-0"}
              title="Загрузить фото"
              style={mobile ? undefined : {padding: '2px 5px', fontSize: '10px'}}
          >
              {mobile ? 'Фото' : '📁'}
              <input type="file" hidden accept="image/*" onChange={(e) => uploadPhoto(e, product)} />
          </label>
          <button
              className={mobile ? "btn btn-outline-danger mobile-action-btn" : "btn btn-xs btn-outline-danger rounded-circle"}
              title="Удалить"
              style={mobile ? undefined : {padding: '2px 5px', fontSize: '10px'}}
              onClick={() => requestDeleteProduct(product)}
          >
              {mobile ? 'Удалить' : '🗑️'}
          </button>
      </div>
  );

  const renderMobileProductCard = (product) => {
      const nameError = getEditingErrorMessage(product.id, 'name');
      const quantityError = getEditingErrorMessage(product.id, 'quantity');
      const priceError = getEditingErrorMessage(product.id, 'price');

      return (
      <div key={product.id} className="card mobile-product-card shadow-sm border-0 rounded-4">
          <div className="mobile-product-header">
              <div className="product-img-container mobile-product-image">
                  <img src={product.photoUrl || FALLBACK_IMAGE} className="product-img" onError={e => e.target.src = FALLBACK_IMAGE} />
              </div>
              <div className="mobile-product-main">
                  {user.role === 'STOREKEEPER' ? (
                      <input
                          className={`form-control border-0 bg-transparent fw-bold mobile-product-name-input product-edit-input ${nameError ? 'product-input-error' : ''}`}
                          value={product.name}
                          onFocus={() => {beginEditing(); clearEditingError();}}
                          onChange={(e) => setLocalProductState(product.id, { name: normalizeProductName(e.target.value) })}
                          onBlur={(e) => updateProduct({ ...product, name: e.target.value }, 'name')}
                      />
                  ) : (
                      <h6 className="mobile-product-name">{product.name}</h6>
                  )}
                  {nameError && <div className="product-inline-error">{nameError}</div>}
                  <div className="mobile-product-id">Товар #{product.id}</div>
              </div>
              {user.role !== 'STOREKEEPER' && (
                  <div className={`badge-custom mobile-quantity-badge ${product.quantity < 200 ? 'bg-critical' : 'bg-ok'}`}>
                      {product.quantity} шт.
                  </div>
              )}
          </div>

          <div className="mobile-product-grid">
              <div className="mobile-product-field">
                  <div className="mobile-product-label">Категория</div>
                  {user.role === 'STOREKEEPER' ? (
                      <select
                          className="form-select mobile-input"
                          value={getProductCategoryId(product)}
                          onChange={(e) => updateProduct({ ...product, category: { id: e.target.value } }, 'category')}
                      >
                          <option value="" disabled>Выбор...</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                  ) : (
                      renderCategoryBadge(product.categoryName)
                  )}
              </div>

              <div className="mobile-product-field">
                  <div className="mobile-product-label">Остаток</div>
                  {user.role === 'STOREKEEPER' ? (
                      <>
                          <input
                              type="number"
                              min="0"
                              className={`form-control mobile-input product-edit-input ${quantityError ? 'product-input-error' : ''}`}
                              value={product.quantity !== null && product.quantity !== undefined ? product.quantity : ''}
                              onFocus={() => {beginEditing(); clearEditingError();}}
                              onChange={(e) => setLocalProductState(product.id, { quantity: e.target.value })}
                              onBlur={(e) => updateProduct({ ...product, quantity: e.target.value }, 'quantity')}
                          />
                          {quantityError && <div className="product-inline-error">{quantityError}</div>}
                      </>
                  ) : (
                      <div className="mobile-product-value mobile-product-qty">{product.quantity} шт.</div>
                  )}
              </div>

              {user.role !== 'STOREKEEPER' && (
                  <div className="mobile-product-field mobile-product-field-wide">
                      <div className="mobile-product-label">Цена</div>
                      {user.role === 'ACCOUNTANT' ? (
                          <div className="mobile-price-editor">
                              <input
                                  type="number"
                                  min="0"
                                  className={`form-control mobile-input product-edit-input ${priceError ? 'product-input-error' : ''}`}
                                  value={product.price !== null && product.price !== undefined ? product.price : ''}
                                  onFocus={() => {beginEditing(); clearEditingError();}}
                                  onChange={(e) => setLocalProductState(product.id, { price: e.target.value })}
                                  onBlur={(e) => updatePrice(product.id, e.target.value)}
                              />
                              <span className="mobile-currency">₽</span>
                          </div>
                      ) : (
                          <div className="mobile-product-value fw-bold">{product.price !== null && product.price !== undefined ? product.price : 0} ₽</div>
                      )}
                      {priceError && <div className="product-inline-error">{priceError}</div>}
                  </div>
              )}
          </div>

          {user.role === 'STOREKEEPER' && renderStorekeeperActions(product, true)}
      </div>
  );
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
                <div className="col-12"><button className="btn btn-outline-success w-100 fw-bold" onClick={() => {setUsername('storekeeper'); setLoginError('');}}>КЛАДОВЩИК</button></div>
                <div className="col-12"><button className="btn btn-outline-primary w-100 fw-bold" onClick={() => {setUsername('manager'); setLoginError('');}}>МЕНЕДЖЕР</button></div>
                <div className="col-12"><button className="btn btn-outline-info w-100 fw-bold" onClick={() => {setUsername('accountant'); setLoginError('');}}>БУХГАЛТЕР</button></div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper min-vh-100">
      <PhotoLinkDialog
        open={photoDialog.open}
        value={photoDialog.value}
        error={photoDialog.error}
        onChange={(value) => setPhotoDialog(prev => ({ ...prev, value, error: '' }))}
        onCancel={closePhotoLinkDialog}
        onConfirm={savePhotoLink}
      />
      <DeleteDialog
        product={deleteCandidate}
        loading={deleteLoading}
        onCancel={closeDeleteModal}
        onConfirm={deleteProduct}
      />
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow sticky-top py-2 py-md-3">
        <div className="container topbar-shell">
          <span className="navbar-brand fw-bold fs-5 fs-md-4">🏭 FishERP 2.0</span>
          <div className="topbar-user">
             <span className="badge bg-primary topbar-badge">{roleRu(user.role)}: {user.fullName}</span>
             <button className="btn btn-danger topbar-logout rounded-3 fw-bold" onClick={logout}>ВЫХОД</button>
          </div>
        </div>
      </nav>

      <div className="container mt-3 mt-md-4 pb-5">
        <section className="hero-panel animate-in mb-3 mb-md-4">
            <div className="hero-panel-copy">
                <div className="hero-kicker">Cannery Warehouse</div>
                <h1 className="hero-title">{roleVisualTitle[user.role] || 'Рабочее пространство склада'}</h1>
                <p className="hero-text mb-0">{roleVisualDescription[user.role] || 'Актуальные остатки, категории и операции по товарам.'}</p>
            </div>
            <div className="hero-badges">
                {overviewCards.map((card) => (
                    <div key={card.label} className={`overview-card ${card.tone}`}>
                        <div className="overview-label">{card.label}</div>
                        <div className="overview-value">{card.value}</div>
                    </div>
                ))}
            </div>
        </section>
        
        {/* РАЗДЕЛ "ИЗЮМИНКИ" */}
        <div className="row mb-3 mb-md-4">
            {user.role === 'STOREKEEPER' && productStats.deficitItems.length > 0 && (
                <div className="col-12 animate-in mb-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white border-start border-danger border-5">
                        <h6 className="fw-bold text-danger mb-3">⚡ Срочно к пополнению (Дефицит менее 200 шт)</h6>
                        <div className="d-flex flex-wrap gap-2">
                            {productStats.deficitItems.map(p => (
                                <span key={p.id} className="badge bg-danger-subtle text-danger p-2 px-3 rounded-pill" style={{fontSize: '0.8rem'}}>
                                    {p.name}: <strong>{p.quantity} шт.</strong>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {user.role === 'STOREKEEPER' && productStats.deficitItems.length === 0 && (
                <div className="col-12 animate-in mb-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white border-start border-success border-5">
                        <div className="d-flex align-items-center text-success fw-bold small">
                            <span className="fs-5 me-2">✅</span> Склад укомплектован: дефицитных позиций нет
                        </div>
                    </div>
                </div>
            )}
            {user.role === 'SALES_MANAGER' && (
                <div className="col-12 animate-in mb-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white">
                        <h6 className="fw-bold mb-3">📈 Структура складских запасов</h6>
                        <div className="row">
                            {productStats.categoryStats.map(s => (
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

        {/* ГЛОБАЛЬНЫЕ УВЕДОМЛЕНИЯ/ОШИБКИ */}
        <AppToast
            message={productError}
            onClose={clearEditingError}
        />

        {/* ОСНОВНОЙ ФУНКЦИОНАЛ */}
        {user.role === 'STOREKEEPER' && (
            <div className="card p-3 p-md-4 shadow-sm border-0 rounded-4 mb-3 mb-md-4 bg-white">
                <h6 className="fw-bold text-muted text-uppercase mb-3 small">Приемка новой партии товара</h6>
                <div className="row g-2 g-md-3 mb-2 align-items-center">
                    <div className="col-12 col-md-3">
                        <input className="form-control bg-light border-0" placeholder="Наименование товара" value={newProduct.name} onChange={e=>{setNewProduct({...newProduct, name: normalizeProductName(e.target.value)}); setProductError('');}} />
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
                                <button className="btn btn-light border-0 d-flex align-items-center px-2" onClick={() => openPhotoLinkDialog()} title="Добавить по ссылке">
                                    🔗
                                </button>
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
            </div>
        )}

        <div className="card toolbar-card shadow-sm p-3 p-md-4 mb-3 mb-md-4 border-0 rounded-4 bg-white">
            <input className="form-control rounded-pill px-4 bg-light border-0 toolbar-search" placeholder="🔍 Поиск по реестру..." onChange={e => setSearch(e.target.value)} />
            <div className="toolbar-actions">
                <select className="form-select rounded-pill bg-light border-0 toolbar-filter" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                    <option value="">Все категории</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="toolbar-buttons">
                    <button className="btn btn-outline-success rounded-pill px-2 px-md-3 fw-bold small-btn toolbar-mobile-btn" onClick={exportToExcel} title="Экспорт в Excel">
                        <span className="toolbar-mobile-icon" aria-hidden="true">📥</span>
                        <span className="toolbar-mobile-copy">
                            <span className="toolbar-mobile-title">ЭКСПОРТ</span>
                            <span className="toolbar-mobile-note">Скачать Excel</span>
                        </span>
                    </button>
                    {user?.role !== 'SALES_MANAGER' && (
                        <label className="btn btn-outline-primary rounded-pill px-2 px-md-3 fw-bold mb-0 small-btn toolbar-mobile-btn" style={{ cursor: 'pointer' }} title="Импорт из Excel">
                            <span className="toolbar-mobile-icon" aria-hidden="true">📤</span>
                            <span className="toolbar-mobile-copy">
                                <span className="toolbar-mobile-title">ИМПОРТ</span>
                                <span className="toolbar-mobile-note">Загрузить Excel</span>
                            </span>
                            <input 
                                type="file" 
                                style={{ display: 'none' }} 
                                accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                                onChange={handleImport} 
                            />
                        </label>
                    )}
                </div>
            </div>
        </div>

        {products.length === 0 ? (
            renderEmptyState()
        ) : (
            <>
                <div className="d-md-none mobile-product-list animate-in">
                    {products.map(renderMobileProductCard)}
                </div>

                <div className="table-responsive animate-in mobile-table-wrap d-none d-md-block">
                    <table className="table modern-table align-middle">
                        <thead>
                            <tr>
                                <th style={{width: '50px'}}>Фото</th>
                                <th>Наименование</th>
                                <th style={{width: '140px'}} className="d-none d-md-table-cell">Категория</th>
                                <th style={{width: '80px'}}>Остаток</th>
                                {user.role !== 'STOREKEEPER' && <th style={{width: '100px'}}>Цена</th>}
                                <th className="text-end pe-4" style={{width: '100px'}}>Опц.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map(p => {
                                const nameError = getEditingErrorMessage(p.id, 'name');
                                const quantityError = getEditingErrorMessage(p.id, 'quantity');
                                const priceError = getEditingErrorMessage(p.id, 'price');

                                return (
                                <tr key={p.id}>
                                    <td data-label="Фото"><div className="product-img-container" style={{width: '40px', height: '40px'}}><img src={p.photoUrl || FALLBACK_IMAGE} className="product-img" style={{width: '40px', height: '40px'}} onError={e=>e.target.src=FALLBACK_IMAGE}/></div></td>
                                    <td data-label="Наименование">
                                        {user.role === 'STOREKEEPER' ? (
                                            <div className="product-edit-cell">
                                                <input className={`form-control form-control-sm border-0 bg-transparent fw-bold p-0 text-primary product-edit-input product-name-input ${nameError ? 'product-input-error' : ''}`} 
                                                value={p.name} 
                                                onFocus={() => {beginEditing(); clearEditingError();}}
                                                onChange={(e) => setLocalProductState(p.id, { name: normalizeProductName(e.target.value) })}
                                                onBlur={(e) => { updateProduct({...p, name: e.target.value}, 'name'); }} />
                                                {nameError && <div className="product-inline-error">{nameError}</div>}
                                            </div>
                                            ) : <div className="fw-bold">{p.name}</div>}
                                    </td>
                                    <td className="d-none d-md-table-cell" data-label="Категория">
                                        {user.role === 'STOREKEEPER' ? (
                                            <select className="form-select form-select-sm border-0 bg-light" value={getProductCategoryId(p)} onChange={(e)=>updateProduct({...p, category: {id: e.target.value}}, 'category')}>
                                                <option value="" disabled>Выбор...</option>
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        ) : renderCategoryBadge(p.categoryName)}
                                    </td>
                                    <td data-label="Остаток">
                                        {user.role === 'STOREKEEPER' ? (
                                            <div className="product-edit-cell">
                                                <input type="number" min="0" className={`form-control form-control-sm w-100 border-0 bg-light fw-bold product-edit-input ${quantityError ? 'product-input-error' : ''}`} 
                                                    value={p.quantity !== null && p.quantity !== undefined ? p.quantity : ''} 
                                                    onFocus={() => {beginEditing(); clearEditingError();}}
                                                    onChange={(e) => setLocalProductState(p.id, { quantity: e.target.value })}
                                                    onBlur={(e) => { updateProduct({...p, quantity: e.target.value}, 'quantity'); }} />
                                                {quantityError && <div className="product-inline-error">{quantityError}</div>}
                                            </div>
                                        ) : (
                                            <span className={`badge-custom ${p.quantity < 200 ? 'bg-critical' : 'bg-ok'}`}>
                                                {p.quantity}
                                            </span>
                                        )}
                                    </td>
                                    {user.role !== 'STOREKEEPER' && (
                                        <td data-label="Цена">
                                            {user.role === 'ACCOUNTANT' ? (
                                                <div className="product-edit-cell">
                                                    <div className="d-flex align-items-center">
                                                        <input type="number" min="0" className={`form-control form-control-sm border-0 bg-transparent fw-bold p-0 product-edit-input ${priceError ? 'product-input-error' : ''}`} 
                                                            value={p.price !== null && p.price !== undefined ? p.price : ''} 
                                                            onFocus={() => {beginEditing(); clearEditingError();}}
                                                            onChange={(e) => setLocalProductState(p.id, { price: e.target.value })}
                                                            onBlur={(e) => { updatePrice(p.id, e.target.value); }} />
                                                        <span className="ms-1 fw-bold">₽</span>
                                                    </div>
                                                    {priceError && <div className="product-inline-error">{priceError}</div>}
                                                </div>
                                            ) : <span className="fw-bold">{p.price !== null && p.price !== undefined ? p.price : 0} ₽</span>}
                                        </td>
                                    )}
                                    <td className="text-end pe-2 pe-md-4" data-label="Опции">
                                        {user.role === 'STOREKEEPER' ? (
                                            renderStorekeeperActions(p)
                                        ) : <span className="text-muted small">🔒</span>}
                                    </td>
                                </tr>
                            );
                            })}
                        </tbody>
                    </table>
                </div>
            </>
        )}
      </div>
    </div>
  );
}

export default App;

