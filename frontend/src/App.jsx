import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';

const API_URL = import.meta.env.VITE_API_URL || '';
const FALLBACK_IMAGE = 'https://cdn-icons-png.flaticon.com/512/1170/1170628.png';
const EMPTY_PRODUCT_STATS = { deficitItems: [], totalValue: 0, categoryStats: [] };
const EMPTY_JOURNAL_FILTERS = { productName: '', startDate: '', endDate: '' };
const EMPTY_NEW_PRODUCT = {
  name: '',
  quantity: '',
  categoryId: '',
  photoUrl: '',
  notes: '',
  qualityStatus: '',
  packagingType: '',
  manufacturer: '',
  brand: ''
};
const QUALITY_OPTIONS = [
  { value: '', label: 'Не указан' },
  { value: 'NORMAL', label: 'Норма' },
  { value: 'REVIEW', label: 'Под вопросом' },
  { value: 'DEFECT', label: 'Брак' }
];
const PACKAGING_OPTIONS = [
  { value: '', label: 'Не указана' },
  { value: 'CANS', label: 'Банки' },
  { value: 'BOXES', label: 'Коробки' },
  { value: 'PACKAGES', label: 'Упаковки' },
  { value: 'PIECES', label: 'Поштучно' }
];
const ROLE_LABELS = {
  STOREKEEPER: 'Кладовщик',
  SALES_MANAGER: 'Менеджер сбыта',
  ACCOUNTANT: 'Бухгалтер',
  SYSTEM: 'Система'
};
const JOURNAL_FIELD_LABELS = {
  name: 'Название',
  quantity: 'Остаток',
  category: 'Категория',
  photoUrl: 'Фото',
  notes: 'Комментарий',
  qualityStatus: 'Статус качества',
  packagingType: 'Упаковка',
  manufacturer: 'Производитель',
  brand: 'Бренд',
  price: 'Цена'
};
const TECHNICAL_JOURNAL_PATTERNS = [/codex/i, /excel duplicate/i, /\?{3,}/];
const DETAILS_TRACKED_FIELDS = ['qualityStatus', 'packagingType', 'manufacturer', 'brand', 'notes'];

const formatOptionalText = (value, fallback = 'Не указано') => {
  const normalized = typeof value === 'string' ? value.trim() : value;
  return normalized ? normalized : fallback;
};

const formatQualityStatus = (value) => (
  QUALITY_OPTIONS.find(option => option.value === value)?.label || 'Не указан'
);

const formatPackagingType = (value) => (
  PACKAGING_OPTIONS.find(option => option.value === value)?.label || 'Не указана'
);

const normalizeOptionalText = (value = '') => {
  const trimmed = value.trim();
  return trimmed ? trimmed : '';
};

const normalizeCategoryName = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.toLowerCase() === 'undefined' || normalized.toLowerCase() === 'null') {
    return 'Без категории';
  }
  return normalized;
};

const buildCategoryOptions = (categories = [], emptyLabel = null) => ([
  ...(emptyLabel !== null ? [{ value: '', label: emptyLabel }] : []),
  ...categories.map((category) => ({
    value: category.id,
    label: normalizeCategoryName(category.name)
  }))
]);

const getComparableDetailsValue = (field, value) => {
  if (field === 'qualityStatus' || field === 'packagingType') {
    return value || '';
  }

  return normalizeOptionalText(typeof value === 'string' ? value : '');
};

const buildDetailsSaveMessage = (initialProduct = {}, nextProduct = {}) => {
  const changedLabels = DETAILS_TRACKED_FIELDS
    .filter((field) => (
      getComparableDetailsValue(field, initialProduct[field]) !== getComparableDetailsValue(field, nextProduct[field])
    ))
    .map((field) => JOURNAL_FIELD_LABELS[field] || field);

  if (!changedLabels.length) {
    return 'Новых изменений не было.';
  }

  if (changedLabels.length === 1) {
    return `Обновлено поле: ${changedLabels[0]}.`;
  }

  return `Обновлены поля: ${changedLabels.join(', ')}.`;
};

const formatJournalDescription = (value = '') => (
  value
    .replaceAll('NORMAL', 'Норма')
    .replaceAll('REVIEW', 'Под вопросом')
    .replaceAll('DEFECT', 'Брак')
    .replaceAll('SPOILAGE', 'Порча')
    .replaceAll('EXPIRED', 'Просрочка')
    .replaceAll('DAMAGED', 'Повреждение')
    .replaceAll('OTHER', 'Другое')
    .replaceAll('CANS', 'Банки')
    .replaceAll('BOXES', 'Коробки')
    .replaceAll('PACKAGES', 'Упаковки')
    .replaceAll('PIECES', 'Поштучно')
);

const formatJournalValue = (value) => {
  if (value === null || value === undefined) {
    return 'Не указано';
  }
  const normalized = formatJournalDescription(String(value)).trim();
  return normalized && normalized.toLowerCase() !== 'null' ? normalized : 'Не указано';
};

const shouldHideJournalEntry = (log = {}) => {
  const haystack = [
    log.productName,
    log.description,
    log.oldValue,
    log.newValue
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return TECHNICAL_JOURNAL_PATTERNS.some((pattern) => pattern.test(haystack));
};

const getJournalEventMeta = (log = {}) => {
  const productName = formatOptionalText(log.productName, 'Без названия');

  if (log.actionType === 'CREATE') {
    return {
      badge: 'Новый товар',
      tone: 'primary',
      title: `Добавлен товар «${productName}»`,
      chips: []
    };
  }

  if (log.actionType === 'DELETE') {
    return {
      badge: 'Удаление',
      tone: 'danger',
      title: `Удален товар «${productName}»`,
      chips: []
    };
  }

  if (log.actionType === 'UPDATE') {
    const fieldLabel = JOURNAL_FIELD_LABELS[log.fieldName] || 'Изменение';
    const tone = log.fieldName === 'price'
      ? 'accent'
      : log.fieldName === 'quantity'
        ? 'primary'
        : 'neutral';

    return {
      badge: fieldLabel,
      tone,
      title: `Обновлено поле «${fieldLabel}» у товара «${productName}»`,
      chips: [
        `Было: ${formatJournalValue(log.oldValue)}`,
        `Стало: ${formatJournalValue(log.newValue)}`
      ]
    };
  }

  return {
    badge: 'Событие',
    tone: 'neutral',
    title: formatJournalDescription(log.description || 'Изменения по товару'),
    chips: []
  };
};

function RoundedSelect({
  options,
  value,
  onChange,
  placeholder = 'Выбор...',
  ariaLabel = 'Выбор значения',
  className = '',
  triggerClassName = '',
  compact = false,
  pill = false,
  treatEmptyAsPlaceholder = false
}) {
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 280,
    openUpward: false
  });

  const normalizedValue = value === null || value === undefined ? '' : String(value);
  const normalizedOptions = options.map((option) => ({
    ...option,
    value: option.value === null || option.value === undefined ? '' : String(option.value)
  }));
  const selectedOption = normalizedOptions.find((option) => option.value === normalizedValue);
  const isPlaceholder = !selectedOption || (treatEmptyAsPlaceholder && selectedOption.value === '');

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const syncMenuPosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const viewportPadding = 16;
      const estimatedMenuHeight = Math.min(320, Math.max(132, normalizedOptions.length * 46 + 18));
      const shouldOpenUpward = rect.bottom + 8 + estimatedMenuHeight > window.innerHeight - viewportPadding
        && rect.top > estimatedMenuHeight + viewportPadding;
      const availableHeight = shouldOpenUpward
        ? Math.max(132, rect.top - viewportPadding - 8)
        : Math.max(132, window.innerHeight - rect.bottom - viewportPadding - 8);

      setMenuStyle({
        top: shouldOpenUpward
          ? Math.max(viewportPadding, rect.top - Math.min(estimatedMenuHeight, availableHeight) - 8)
          : rect.bottom + 8,
        left: Math.max(viewportPadding, rect.left),
        width: rect.width,
        maxHeight: availableHeight,
        openUpward: shouldOpenUpward
      });
    };

    const handlePointerDown = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    syncMenuPosition();
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', syncMenuPosition);
    window.addEventListener('scroll', syncMenuPosition, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', syncMenuPosition);
      window.removeEventListener('scroll', syncMenuPosition, true);
    };
  }, [open, normalizedOptions.length]);

  const wrapperClasses = [
    'soft-dropdown',
    compact ? 'soft-dropdown-compact' : '',
    pill ? 'soft-dropdown-pill' : '',
    className
  ].filter(Boolean).join(' ');

  const triggerClasses = [
    'soft-dropdown-trigger',
    compact ? 'soft-dropdown-trigger-compact' : '',
    pill ? 'soft-dropdown-trigger-pill' : '',
    open ? 'is-open' : '',
    isPlaceholder ? 'is-placeholder' : '',
    triggerClassName
  ].filter(Boolean).join(' ');

  const handleSelect = (nextValue) => {
    onChange(String(nextValue));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={wrapperClasses}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClasses}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="soft-dropdown-label">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="soft-dropdown-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className={`soft-dropdown-menu ${compact ? 'soft-dropdown-menu-compact' : ''} ${pill ? 'soft-dropdown-menu-pill' : ''} ${menuStyle.openUpward ? 'soft-dropdown-menu-upward' : ''}`}
          role="listbox"
          style={{
            top: `${menuStyle.top}px`,
            left: `${menuStyle.left}px`,
            width: `${menuStyle.width}px`,
            maxHeight: `${menuStyle.maxHeight}px`
          }}
        >
          {normalizedOptions.map((option) => {
            const isSelected = option.value === normalizedValue;

            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`soft-dropdown-option ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handleSelect(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

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

function PhotoLinkDialog({ open, value, error, loading, onChange, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="app-modal-backdrop" onClick={loading ? undefined : onCancel}>
      <div className="app-modal animate-in" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-header">
          <div>
            <div className="app-modal-kicker">Фото товара</div>
            <h5 className="app-modal-title">Ссылка на изображение</h5>
          </div>
          <button type="button" className="btn-close" onClick={onCancel} disabled={loading} />
        </div>
        <p className="app-modal-text">
          Вставьте прямую ссылку на фото товара. После сохранения изображение появится в списке.
        </p>
        <div className="photo-link-preview">
          <img
            src={value.trim() || FALLBACK_IMAGE}
            alt="Предпросмотр фото"
            onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }}
          />
        </div>
        <input
          type="url"
          className="form-control app-modal-input"
          placeholder="https://example.com/photo.jpg"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={loading}
          autoFocus
        />
        {error && <div className="app-modal-error">{error}</div>}
        <div className="app-modal-actions">
          <button type="button" className="btn btn-light" onClick={onCancel} disabled={loading}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={loading}>
            {loading ? 'Проверка...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AppToast({ title = 'Проверьте данные', message, onClose, tone = 'error', icon = '!' }) {
  if (!message || typeof document === 'undefined') return null;

  return createPortal(
    <div className={`app-toast-wrap app-toast-wrap-${tone}`} aria-live={tone === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
      <div className={`app-toast app-toast-${tone} animate-in`} role={tone === 'error' ? 'alert' : 'status'}>
        <div className="app-toast-accent" aria-hidden="true">{icon}</div>
        <div className="app-toast-content">
          <div className="app-toast-title">{title}</div>
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
    </div>,
    document.body
  );
}

function ProductDetailsDialog({ open, product, canEdit, loading, successMessage, onChange, onCancel, onSave }) {
  if (!open || !product) return null;

  return (
    <div className="app-modal-backdrop" onClick={loading ? undefined : onCancel}>
      <div className="app-modal app-modal-wide product-details-modal animate-in" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-header">
          <div>
            <div className="app-modal-kicker">Карточка товара</div>
            <h5 className="app-modal-title">{product.name || 'Новая карточка'}</h5>
          </div>
          <button type="button" className="btn-close" onClick={onCancel} disabled={loading} />
        </div>

        <div className="product-details-shell">
          <div className="product-details-top">
            <div className="product-details-photo-frame">
              <div className="product-details-photo">
                <img
                  src={product.photoUrl || FALLBACK_IMAGE}
                  alt={product.name || 'Товар'}
                  onError={(event) => { event.target.src = FALLBACK_IMAGE; }}
                />
              </div>
            </div>
            <div className="product-details-summary">
              <div className="product-details-summary-item">
                <span className="product-details-summary-label">Качество</span>
                <span className="product-details-summary-value">{formatQualityStatus(product.qualityStatus)}</span>
              </div>
              <div className="product-details-summary-item">
                <span className="product-details-summary-label">Упаковка</span>
                <span className="product-details-summary-value">{formatPackagingType(product.packagingType)}</span>
              </div>
              <div className="product-details-summary-item">
                <span className="product-details-summary-label">Производитель</span>
                <span className="product-details-summary-value">{formatOptionalText(product.manufacturer)}</span>
              </div>
              <div className="product-details-summary-item">
                <span className="product-details-summary-label">Бренд</span>
                <span className="product-details-summary-value">{formatOptionalText(product.brand)}</span>
              </div>
            </div>
          </div>

          <div className="product-details-form-grid">
            <div className="product-details-form-field">
              <label className="product-details-field-label">Статус качества</label>
              <select
                className="form-select product-details-control"
                value={product.qualityStatus || ''}
                onChange={(event) => onChange('qualityStatus', event.target.value)}
                disabled={!canEdit || loading}
              >
                {QUALITY_OPTIONS.map(option => (
                  <option key={option.value || 'empty'} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="product-details-form-field">
              <label className="product-details-field-label">Упаковка</label>
              <select
                className="form-select product-details-control"
                value={product.packagingType || ''}
                onChange={(event) => onChange('packagingType', event.target.value)}
                disabled={!canEdit || loading}
              >
                {PACKAGING_OPTIONS.map(option => (
                  <option key={option.value || 'empty'} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="product-details-form-field">
              <label className="product-details-field-label">Производитель</label>
              <input
                className="form-control product-details-control"
                value={product.manufacturer || ''}
                onChange={(event) => onChange('manufacturer', event.target.value)}
                disabled={!canEdit || loading}
                placeholder="Можно оставить пустым"
              />
            </div>
            <div className="product-details-form-field">
              <label className="product-details-field-label">Бренд</label>
              <input
                className="form-control product-details-control"
                value={product.brand || ''}
                onChange={(event) => onChange('brand', event.target.value)}
                disabled={!canEdit || loading}
                placeholder="Можно оставить пустым"
              />
            </div>
            <div className="product-details-form-field product-details-form-field-wide">
              <label className="product-details-field-label">Комментарий</label>
              <textarea
                className="form-control product-details-control product-details-notes"
                value={product.notes || ''}
                onChange={(event) => onChange('notes', event.target.value)}
                disabled={!canEdit || loading}
                placeholder="Заметки по товару, партии, состоянию и т.д."
              />
            </div>
          </div>
        </div>

        <div className={`app-modal-actions ${successMessage ? 'app-modal-actions-with-status' : ''}`}>
          {successMessage && (
            <div className="app-modal-success" role="status" aria-live="polite">
              Сохранено. {successMessage}
            </div>
          )}
          <div className="app-modal-actions-buttons">
            <button type="button" className="btn btn-light" onClick={onCancel} disabled={loading}>
              Закрыть
            </button>
            {canEdit && (
              <button type="button" className="btn btn-primary" onClick={onSave} disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить карточку'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityLogDialog({ open, logs, loading, filters, onFilterChange, onClose }) {
  if (!open) return null;

  return (
    <div className="app-modal-backdrop" onClick={onClose}>
      <div className="app-modal app-modal-wide animate-in" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-header">
          <div>
            <div className="app-modal-kicker">Менеджер</div>
            <h5 className="app-modal-title">Журнал изменений</h5>
          </div>
          <button type="button" className="btn-close" onClick={onClose} />
        </div>

        <div className="journal-shell">
          <section className="journal-section">
            <div className="journal-section-header">
              <h6 className="journal-section-title">Фильтры журнала</h6>
              <span className="journal-section-note">Ищите изменения по названию товара и по дате</span>
            </div>
            <div className="journal-filter-grid">
              <div className="journal-filter-field journal-filter-field-wide">
                <label className="journal-filter-label">Название товара</label>
                <input
                  className="form-control journal-filter-control"
                  value={filters.productName}
                  placeholder="Например: Печень трески"
                  onChange={(event) => onFilterChange('productName', event.target.value)}
                />
              </div>
              <div className="journal-filter-field">
                <label className="journal-filter-label">Дата с</label>
                <input
                  type="date"
                  className="form-control journal-filter-control"
                  value={filters.startDate}
                  onChange={(event) => onFilterChange('startDate', event.target.value)}
                />
              </div>
              <div className="journal-filter-field">
                <label className="journal-filter-label">Дата по</label>
                <input
                  type="date"
                  className="form-control journal-filter-control"
                  value={filters.endDate}
                  onChange={(event) => onFilterChange('endDate', event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="journal-section">
            <div className="journal-section-header">
              <h6 className="journal-section-title">История изменений</h6>
              <span className="journal-section-note">Цена, остаток, категория, карточка товара и другие изменения</span>
            </div>
            {loading ? (
              <div className="journal-empty-card">Загрузка журнала...</div>
            ) : logs.length === 0 ? (
              <div className="journal-empty-card">По выбранным фильтрам записей не найдено.</div>
            ) : (
              <div className="journal-timeline">
                {logs.map(log => (
                  (() => {
                    const eventMeta = getJournalEventMeta(log);

                    return (
                      <article key={log.id} className="journal-entry">
                        <div className="journal-entry-content">
                          <div className="journal-entry-meta">
                            <span className="journal-entry-meta-actor">{log.actorName || 'Система'}</span>
                            <span className="journal-entry-meta-role">{ROLE_LABELS[log.actorRole] || log.actorRole || 'Система'}</span>
                            <span className="journal-entry-meta-date">{new Date(log.createdAt).toLocaleString('ru-RU')}</span>
                          </div>
                          <div className="journal-entry-top">
                            <span className={`journal-entry-badge journal-entry-badge-${eventMeta.tone}`}>
                              {eventMeta.badge}
                            </span>
                            <div className="journal-entry-title">{eventMeta.title}</div>
                          </div>
                          {eventMeta.chips.length > 0 && (
                            <div className="journal-entry-chips">
                              {eventMeta.chips.map((chip) => (
                                <span key={chip} className="journal-entry-chip">{chip}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })()
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="app-modal-actions journal-modal-actions">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newProduct, setNewProduct] = useState(EMPTY_NEW_PRODUCT);
  const [loginError, setLoginError] = useState('');
  const [productError, setProductError] = useState('');
  const [productStats, setProductStats] = useState(EMPTY_PRODUCT_STATS);
  const [editingErrorId, setEditingErrorId] = useState(null);
  const [editingErrorField, setEditingErrorField] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [photoDialog, setPhotoDialog] = useState({ open: false, product: null, value: '', error: '', loading: false });
  const [detailsDialog, setDetailsDialog] = useState({ open: false, product: null, initialProduct: null });
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsSuccessMessage, setDetailsSuccessMessage] = useState('');
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogLoading, setActivityLogLoading] = useState(false);
  const [journalFilters, setJournalFilters] = useState(EMPTY_JOURNAL_FILTERS);
  const [feedbackToast, setFeedbackToast] = useState({ title: '', message: '', tone: 'success', icon: '✓' });
  const pendingSaveRequestsRef = useRef(new Set());
  const passwordInputRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  
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
    if (!detailsDialog.open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !detailsLoading) {
        setDetailsDialog({ open: false, product: null, initialProduct: null });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailsDialog.open, detailsLoading]);

  useEffect(() => {
    if (!activityLogOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !activityLogLoading) {
        setActivityLogOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activityLogOpen, activityLogLoading]);

  useEffect(() => {
    const shouldLockScroll = Boolean(deleteCandidate)
      || photoDialog.open
      || detailsDialog.open
      || activityLogOpen;
    document.body.classList.toggle('app-modal-open', shouldLockScroll);

    return () => {
      document.body.classList.remove('app-modal-open');
    };
  }, [deleteCandidate, photoDialog.open, detailsDialog.open, activityLogOpen]);

  const roleRu = (role) => {
    return ROLE_LABELS[role] || role;
  };

  const authHeader = () => ({ headers: { Authorization: localStorage.getItem('token') } });

  const [loginLoading, setLoginLoading] = useState(false);

  const fillLoginRole = (roleLogin) => {
    setUsername(roleLogin);
    setLoginError('');

    requestAnimationFrame(() => {
      passwordInputRef.current?.focus();
    });
  };

  const login = async (e) => {
    if (e) e.preventDefault();
    
    const finalUsername = username.trim().toLowerCase();
    const finalPassword = password;

    if (!finalUsername) {
        setLoginError('Введите логин');
        return;
    }

    if (!finalPassword) {
        setLoginError('Введите пароль');
        return;
    }

    setLoginLoading(true);
    setLoginError('');
    
    // Proper way to handle UTF-8 in Basic Auth
    const token = 'Basic ' + btoa(encodeURIComponent(finalUsername + ':' + finalPassword).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1)));
    
    try {
      const res = await axios.get(API_URL + '/api/auth/me', { headers: { Authorization: token } });
      localStorage.setItem('token', token);
      setShowPassword(false);
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

  const handleLoginKeyDown = (event) => {
      if (event.key === 'Enter') {
          event.preventDefault();
          login();
      }
  };

  const logout = () => {
      localStorage.removeItem('token');
      setUser(null);
      setLoginError('');
      setUsername('');
      setPassword('');
      setShowPassword(false);
  };

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
      const categoryName = normalizeCategoryName(item?.categoryName);
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
    const url = `${API_URL}/api/products/stats${query ? `?${query}` : ''}`;

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
      const suffix = query ? `?${query}` : '';
      const [pRes, cRes] = await Promise.all([
          axios.get(`${API_URL}/api/products${suffix}`, headers),
          axios.get(API_URL + '/api/categories', headers)
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

  // Первоначальная загрузка и восстановление сессии
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
        axios.get(API_URL + '/api/auth/me', { headers: { Authorization: token } })
            .then(res => {
                setUser(res.data);
            })
            .catch(() => {
                localStorage.removeItem('token');
            });
    }
  }, []);

  useEffect(() => {
    if (user) {
        fetchData();
    }
  }, [user, fetchData]);

  // Интервал автоматического обновления (5 секунд)
  useEffect(() => {
    if (user) {
        const interval = setInterval(() => {
            fetchData();
        }, 5000); 
        return () => clearInterval(interval);
    }
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

  const normalizeIntegerInput = (value = '') => String(value ?? '').replace(/[^\d]/g, '');

  const buildProductPayload = (productLike) => {
      const categoryId = productLike.category?.id || productLike.categoryId;
      return {
          ...productLike,
          name: normalizeProductName(productLike.name),
          quantity: parseInt(productLike.quantity, 10),
          photoUrl: normalizeOptionalText(productLike.photoUrl) || null,
          notes: normalizeOptionalText(productLike.notes) || null,
          qualityStatus: productLike.qualityStatus || null,
          packagingType: productLike.packagingType || null,
          manufacturer: normalizeOptionalText(productLike.manufacturer) || null,
          brand: normalizeOptionalText(productLike.brand) || null,
          category: (categoryId && categoryId !== '') ? { id: parseInt(categoryId, 10) } : null
      };
  };

  const updateNewProductField = (field, value) => {
      setNewProduct(prev => ({
          ...prev,
          [field]: field === 'quantity' ? normalizeIntegerInput(value) : value
      }));
      setProductError('');
  };

  const addProduct = async () => {
    setProductError('');
    const normalizedName = normalizeProductName(newProduct.name);
    if (!normalizedName.trim()) return setProductError('Введите название товара!');
    if (!newProduct.categoryId) return setProductError('Выберите категорию!');
    if (newProduct.quantity === '') return setProductError('Введите количество!');
    if (parseInt(newProduct.quantity, 10) < 0) return setProductError('Количество не может быть отрицательным!');

    try {
      await axios.post(API_URL + '/api/products', buildProductPayload(newProduct), authHeader());
      setNewProduct(EMPTY_NEW_PRODUCT);
      fetchData();
    } catch (err) { setProductError(getApiErrorMessage(err, 'Ошибка при сохранении')); }
  };

  const updateProduct = async (p, editedField = '') => {
      const trimmedName = normalizeProductName(p.name);
      if (!trimmedName) {
          showEditingValidationError('Название товара обязательно', p.id, 'name');
          return false;
      }

      if (p.quantity === "" || p.quantity === null || p.quantity === undefined) {
          showEditingValidationError('Введите количество!', p.id, 'quantity');
          return false; 
      }

      clearEditingError();
      beginEditing(); 

      let qVal = parseInt(p.quantity, 10);
      
      if (isNaN(qVal) || qVal < 0) {
          showEditingValidationError(qVal < 0 ? 'Минус нельзя!' : 'Введите число!', p.id, 'quantity');
          return false;
      }
      
      const catId = p.category?.id || p.categoryId;
      const nextProducts = products.map(item => item.id === p.id ? { ...p, name: trimmedName, quantity: qVal, categoryId: catId } : item);
      setProducts(nextProducts);

      const productToSend = buildProductPayload({
          ...p,
          name: trimmedName,
          quantity: qVal,
          categoryId: catId
      });

      try {
          await trackPendingSave(axios.put(`${API_URL}/api/products/${p.id}`, productToSend, authHeader()));
          fetchProductStats(null, true, nextProducts);
          endEditingLater();
          return true;
      } catch (err) { 
          resetEditingWithError(getApiErrorMessage(err, 'Ошибка сохранения'), p.id, editedField);
          return false;
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
          await trackPendingSave(axios.put(`${API_URL}/api/products/${id}/price`, { price: pVal }, authHeader()));
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

  const trackPendingSave = (requestPromise) => {
      pendingSaveRequestsRef.current.add(requestPromise);
      requestPromise.finally(() => pendingSaveRequestsRef.current.delete(requestPromise));
      return requestPromise;
  };

  const waitForPendingSaves = async () => {
      const pendingRequests = Array.from(pendingSaveRequestsRef.current);
      if (!pendingRequests.length) return;
      await Promise.allSettled(pendingRequests);
  };

  const exportToExcel = async () => {
    try {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        await waitForPendingSaves();
        await fetchData();
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
              setNewProduct(prev => ({ ...prev, photoUrl }));
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
      const nextPatch = { ...patch };
      if (Object.prototype.hasOwnProperty.call(nextPatch, 'quantity')) {
          nextPatch.quantity = normalizeIntegerInput(nextPatch.quantity);
      }
      setProducts(prev => prev.map(item => item.id === id ? { ...item, ...nextPatch } : item));
  };
  const openPhotoLinkDialog = (product = null) => {
      setPhotoDialog({
          open: true,
          product,
          value: product?.photoUrl || newProduct.photoUrl || '',
          error: '',
          loading: false
      });
  };
  const closePhotoLinkDialog = () => {
      if (photoDialog.loading) return;
      setPhotoDialog({ open: false, product: null, value: '', error: '', loading: false });
  };
  const preloadImage = (url) => new Promise((resolve, reject) => {
      const image = new Image();
      const timeoutId = window.setTimeout(() => reject(new Error('timeout')), 7000);
      image.onload = () => {
          window.clearTimeout(timeoutId);
          resolve(url);
      };
      image.onerror = () => {
          window.clearTimeout(timeoutId);
          reject(new Error('image-error'));
      };
      image.src = url;
  });

  const savePhotoLink = async () => {
      const normalizedUrl = photoDialog.value.trim();
      if (!normalizedUrl) {
          setPhotoDialog(prev => ({ ...prev, error: 'Введите ссылку на фото' }));
          return;
      }

      setPhotoDialog(prev => ({ ...prev, error: '', loading: true }));

      try {
          await preloadImage(normalizedUrl);
      } catch (err) {
          setPhotoDialog(prev => ({
              ...prev,
              loading: false,
              error: 'Не удалось загрузить изображение. Пока используйте другую ссылку или загрузите файл.'
          }));
          return;
      }

      if (photoDialog.product) {
          await updateProduct({ ...photoDialog.product, photoUrl: normalizedUrl }, 'photoUrl');
      } else {
          setNewProduct(prev => ({ ...prev, photoUrl: normalizedUrl }));
          setProductError('');
      }

      setPhotoDialog({ open: false, product: null, value: '', error: '', loading: false });
  };

  const openDetailsDialog = (product) => {
      clearDetailsSuccessState();
      setDetailsDialog({ open: true, product: { ...product }, initialProduct: { ...product } });
  };

  const closeDetailsDialog = () => {
      if (detailsLoading) return;
      clearDetailsSuccessState();
      setDetailsDialog({ open: false, product: null, initialProduct: null });
  };

  const updateDetailsField = (field, value) => {
      if (detailsSuccessMessage) {
          clearDetailsSuccessState();
      }
      setDetailsDialog(prev => ({
          ...prev,
          product: { ...prev.product, [field]: value }
      }));
  };

  const saveDetailsDialog = async () => {
      if (!detailsDialog.product) return;
      setDetailsLoading(true);
      try {
          const isSaved = await updateProduct({ ...detailsDialog.product }, 'details');
          if (isSaved) {
              const successMessage = buildDetailsSaveMessage(detailsDialog.initialProduct, detailsDialog.product);
              clearDetailsSuccessState();
              setDetailsSuccessMessage(successMessage);
              setFeedbackToast({
                  title: 'Карточка сохранена',
                  message: successMessage,
                  tone: 'success',
                  icon: '✓'
              });
              setDetailsDialog(prev => ({
                  ...prev,
                  initialProduct: { ...prev.product }
              }));
          }
      } finally {
          setDetailsLoading(false);
      }
  };

  const updateJournalFilter = useCallback((field, value) => {
      setJournalFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  const fetchActivityLogData = useCallback(async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      setActivityLogLoading(true);
      try {
          const headers = { headers: { Authorization: token } };
          const params = new URLSearchParams();
          if (journalFilters.productName.trim()) params.set('productName', journalFilters.productName.trim());
          if (journalFilters.startDate) params.set('startDate', journalFilters.startDate);
          if (journalFilters.endDate) params.set('endDate', journalFilters.endDate);
          const query = params.toString();
          const logsRes = await axios.get(`${API_URL}/api/activity-logs${query ? `?${query}` : ''}`, headers);
          const visibleLogs = (logsRes.data || []).filter((log) => !shouldHideJournalEntry(log));
          setActivityLogs(visibleLogs);
      } catch (err) {
          setActivityLogs([]);
          setProductError(getApiErrorMessage(err, 'Не удалось загрузить журнал изменений'));
      } finally {
          setActivityLogLoading(false);
      }
  }, [journalFilters]);

  const openActivityJournal = () => {
      setActivityLogOpen(true);
  };

  useEffect(() => {
    if (!activityLogOpen) return undefined;

    const timeoutId = window.setTimeout(() => {
      fetchActivityLogData();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [activityLogOpen, fetchActivityLogData]);

  useEffect(() => {
    if (!feedbackToast.message) return undefined;

    const timeoutId = window.setTimeout(() => {
      setFeedbackToast({ title: '', message: '', tone: 'success', icon: '✓' });
    }, 3600);

    return () => window.clearTimeout(timeoutId);
  }, [feedbackToast.message]);

  useEffect(() => {
    if (!detailsSuccessMessage) return undefined;

    const timeoutId = window.setTimeout(() => {
      setDetailsSuccessMessage('');
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [detailsSuccessMessage]);

  const clearDetailsSuccessState = useCallback(() => {
    setDetailsSuccessMessage('');
  }, []);

  const totalQuantity = products.reduce((sum, item) => sum + Number(item?.quantity ?? 0), 0);
  const currentRole = user?.role || '';
  const roleVisualTitle = {
      STOREKEEPER: 'Живой реестр склада',
      ACCOUNTANT: 'Финансовый срез остатков',
      SALES_MANAGER: 'Журнал и контроль ассортимента'
  };
  const roleVisualDescription = {
      STOREKEEPER: 'Контроль приемки, дефицита и карточек товаров в одном экране.',
      ACCOUNTANT: 'Стоимость, остатки и цены собраны в одном рабочем представлении.',
      SALES_MANAGER: 'История изменений и структура ассортимента собраны в одном представлении.'
  };

  const getCategoryTone = (categoryName = '') => {
      const normalized = String(categoryName || '').toLowerCase();
      if (normalized.includes('масл')) return 'category-pill-oil';
      if (normalized.includes('томат')) return 'category-pill-tomato';
      if (normalized.includes('натурал')) return 'category-pill-natural';
      if (normalized.includes('паштет')) return 'category-pill-pate';
      return 'category-pill-default';
  };

  const renderCategoryBadge = (categoryName) => (
      <span className={`category-pill ${getCategoryTone(categoryName)}`}>
          {normalizeCategoryName(categoryName)}
      </span>
  );

  const renderProductMeta = (product, compact = false) => {
      const metaItems = [
          product.qualityStatus ? { key: 'quality', tone: `meta-chip-${product.qualityStatus.toLowerCase()}`, label: formatQualityStatus(product.qualityStatus) } : null,
          product.packagingType ? { key: 'packaging', tone: 'meta-chip-neutral', label: formatPackagingType(product.packagingType) } : null,
          product.manufacturer ? { key: 'manufacturer', tone: 'meta-chip-muted', label: product.manufacturer } : null,
          product.brand ? { key: 'brand', tone: 'meta-chip-accent', label: product.brand } : null
      ].filter(Boolean);

      if (metaItems.length === 0 && !product.notes) return null;

      return (
          <div className={`product-meta-wrap ${compact ? 'product-meta-wrap-compact' : ''}`}>
              {metaItems.map(item => (
                  <span key={item.key} className={`product-meta-chip ${item.tone}`}>{item.label}</span>
              ))}
              {product.notes && (
                  <span className="product-meta-note" title={product.notes}>
                      {compact ? 'Есть комментарий' : `Комментарий: ${product.notes}`}
                  </span>
              )}
          </div>
      );
  };

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
      <div className={mobile ? "mobile-product-actions" : "product-action-panel"}>
          <div className={mobile ? "mobile-product-actions-grid" : "product-action-row product-action-row-primary"}>
              <button
                  className={mobile ? "btn product-action-btn product-action-btn-primary mobile-action-btn" : "btn product-action-btn product-action-btn-primary"}
                  onClick={() => openDetailsDialog(product)}
                  title="Открыть карточку товара"
              >
                  Карточка
              </button>
          </div>
          <div className={mobile ? "mobile-product-actions-grid" : "product-action-row product-action-row-secondary"}>
              <button
                  className={mobile ? "btn product-action-btn product-action-btn-link mobile-action-btn" : "btn product-action-btn product-action-btn-link"}
                  onClick={() => openPhotoLinkDialog(product)}
                  title="Добавить фото по ссылке"
              >
                  Фото по ссылке
              </button>
          </div>
          <div className={mobile ? "mobile-product-actions-grid" : "product-action-row product-action-row-tertiary"}>
              <label
                  className={mobile ? "btn product-action-btn product-action-btn-upload mobile-action-btn mb-0" : "btn product-action-btn product-action-btn-upload mb-0"}
                  title="Загрузить фото"
              >
                  Загрузить фото
                  <input type="file" hidden accept="image/*" onChange={(e) => uploadPhoto(e, product)} />
              </label>
              <button
                  className={mobile ? "btn product-action-btn product-action-btn-danger mobile-action-btn" : "btn product-action-btn product-action-btn-danger"}
                  title="Удалить товар"
                  onClick={() => requestDeleteProduct(product)}
              >
                  Удалить
              </button>
          </div>
      </div>
  );

  const renderReadonlyActions = (product, mobile = false) => (
      <div className={mobile ? "mobile-product-actions" : "product-action-panel product-action-panel-readonly"}>
          <div className={mobile ? "mobile-product-actions-grid" : "product-action-row"}>
              <button
                  className={mobile ? "btn product-action-btn product-action-btn-primary mobile-action-btn" : "btn product-action-btn product-action-btn-primary"}
                  onClick={() => openDetailsDialog(product)}
                  title="Открыть карточку товара"
              >
                  Карточка
              </button>
          </div>
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
                  {renderProductMeta(product, true)}
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
                      <RoundedSelect
                          triggerClassName="mobile-input"
                          value={getProductCategoryId(product)}
                          options={buildCategoryOptions(categories)}
                          placeholder="Выбор..."
                          ariaLabel="Выбор категории товара"
                          onChange={(nextValue) => updateProduct({ ...product, category: { id: nextValue } }, 'category')}
                      />
                  ) : (
                      renderCategoryBadge(product.categoryName)
                  )}
              </div>

              <div className="mobile-product-field">
                  <div className="mobile-product-label">Остаток</div>
                  {user.role === 'STOREKEEPER' ? (
                      <>
                          <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
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

          {user.role === 'STOREKEEPER'
            ? renderStorekeeperActions(product, true)
            : renderReadonlyActions(product, true)}
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
          <div className="login-form-shell" onKeyDown={handleLoginKeyDown}>
            <input type="text" tabIndex={-1} autoComplete="username" aria-hidden="true" className="login-decoy-input" />
            <input type="password" tabIndex={-1} autoComplete="new-password" aria-hidden="true" className="login-decoy-input" />
            <div className="mb-3">
              <label className="small fw-bold text-secondary">ЛОГИН</label>
              <input
                className="form-control rounded-3"
                value={username}
                name="warehouse-login"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                data-form-type="other"
                spellCheck={false}
                onChange={e => {setUsername(e.target.value); setLoginError('');}}
              />
            </div>
            <div className="mb-4">
              <label className="small fw-bold text-secondary">ПАРОЛЬ</label>
              <div className="password-field-wrap">
                <input
                  ref={passwordInputRef}
                  className="form-control rounded-3 password-field-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  name="warehouse-passcode"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="new-password"
                  data-form-type="other"
                  data-lpignore="true"
                  inputMode="numeric"
                  onChange={e => {setPassword(e.target.value); setLoginError('');}}
                />
                <button
                  type="button"
                  className="password-visibility-btn"
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setShowPassword(prev => !prev)}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                      <path
                        d="M3 3L21 21M10.58 10.58A2 2 0 0013.41 13.41M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7-0.66 1.48-1.73 2.84-3.08 3.96M6.1 6.1C3.97 7.57 2.35 9.62 1 12c1.73 3.89 6 7 11 7 1.55 0 3.04-.3 4.4-.84"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                      <path
                        d="M1 12C2.73 8.11 7 5 12 5s9.27 3.11 11 7c-1.73 3.89-6 7-11 7S2.73 15.89 1 12z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            {loginError && (
              <div className="alert alert-danger py-2 small fw-bold text-center mb-3 rounded-3" style={{fontSize: '0.85rem'}}>
                ⚠️ {loginError}
              </div>
            )}
            
            <button type="button" className="btn btn-primary btn-lg w-100 rounded-3 shadow-sm fw-bold" disabled={loginLoading} onClick={login}>
                {loginLoading ? 'ВХОД...' : 'ВОЙТИ'}
            </button>
          </div>
          <div className="mt-5 pt-4 border-top login-role-block">
             <div className="row g-2 login-role-grid">
                <div className="col-12"><button type="button" className="btn btn-outline-success w-100 fw-bold" onClick={() => fillLoginRole('storekeeper')}>КЛАДОВЩИК</button></div>
                <div className="col-12"><button type="button" className="btn btn-outline-primary w-100 fw-bold" onClick={() => fillLoginRole('manager')}>МЕНЕДЖЕР</button></div>
                <div className="col-12"><button type="button" className="btn btn-outline-info w-100 fw-bold" onClick={() => fillLoginRole('accountant')}>БУХГАЛТЕР</button></div>             </div>
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
        loading={photoDialog.loading}
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
      <ProductDetailsDialog
        open={detailsDialog.open}
        product={detailsDialog.product}
        canEdit={user?.role === 'STOREKEEPER'}
        loading={detailsLoading}
        successMessage={detailsSuccessMessage}
        onChange={updateDetailsField}
        onCancel={closeDetailsDialog}
        onSave={saveDetailsDialog}
      />
      <ActivityLogDialog
        open={activityLogOpen}
        logs={activityLogs}
        loading={activityLogLoading}
        filters={journalFilters}
        onFilterChange={updateJournalFilter}
        onClose={() => setActivityLogOpen(false)}
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

      <div className="container mt-3 mt-md-4 pb-5 app-container">
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
                            {productStats.categoryStats.map((s, index) => {
                                const categoryLabel = normalizeCategoryName(s.name);
                                return (
                                <div key={`${categoryLabel}-${index}`} className="col-md-4 col-12 mb-3">
                                    <div className="small fw-bold text-muted mb-1">{categoryLabel}</div>
                                    <div className="progress" style={{height: '8px'}}>
                                        <div className="progress-bar bg-primary" style={{width: `${s.percent}%`}}></div>
                                    </div>
                                    <div className="text-end small fw-bold mt-1">{s.percent}%</div>
                                </div>
                            );
                            })}
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
        <AppToast
            title={feedbackToast.title}
            message={feedbackToast.message}
            tone={feedbackToast.tone}
            icon={feedbackToast.icon}
            onClose={() => setFeedbackToast({ title: '', message: '', tone: 'success', icon: '✓' })}
        />

        {/* ОСНОВНОЙ ФУНКЦИОНАЛ */}
        {user.role === 'STOREKEEPER' && (
            <div className="card p-3 p-md-4 shadow-sm border-0 rounded-4 mb-3 mb-md-4 bg-white intake-card">
                <h6 className="fw-bold text-muted text-uppercase mb-3 small">Приемка новой партии товара</h6>
                <div className="row g-2 g-md-3 mb-2 align-items-center">
                    <div className="col-12 col-md-3">
                        <input className="form-control bg-light border-0" placeholder="Наименование товара" value={newProduct.name} onChange={e=>updateNewProductField('name', normalizeProductName(e.target.value))} />
                    </div>
                    <div className="col-6 col-md-2">
                        <RoundedSelect
                            value={newProduct.categoryId}
                            options={buildCategoryOptions(categories, 'Категория...')}
                            placeholder="Категория..."
                            treatEmptyAsPlaceholder
                            ariaLabel="Выбор категории для нового товара"
                            onChange={(nextValue) => updateNewProductField('categoryId', nextValue)}
                        />
                    </div>
                    <div className="col-6 col-md-2">
                        <input type="text" inputMode="numeric" pattern="[0-9]*" className="form-control bg-light border-0" placeholder="Кол-во" value={newProduct.quantity} onChange={e=>updateNewProductField('quantity', e.target.value)} />
                    </div>
                    <div className="col-12 col-md-3">
                        <div className="d-flex align-items-center gap-2 intake-photo-row">
                            {newProduct.photoUrl && (
                                <img src={newProduct.photoUrl} className="rounded-2 shadow-sm border intake-photo-preview" style={{width: '38px', height: '38px', objectFit: 'cover'}} 
                                     onError={(e) => e.target.style.display = 'none'} 
                                     onLoad={(e) => e.target.style.display = 'block'} />
                            )}
                            <div className="input-group bg-light rounded-3 overflow-hidden intake-photo-input">
                                <input className="form-control border-0 bg-transparent" placeholder="Ссылка или файл..." value={newProduct.photoUrl} onChange={e=>updateNewProductField('photoUrl', e.target.value)} />
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
                <div className="row g-2 g-md-3 mt-1">
                    <div className="col-12 col-md-3">
                        <label className="form-label small fw-bold text-secondary mb-1">Статус качества</label>
                        <select className="form-select bg-light border-0" value={newProduct.qualityStatus} onChange={e=>updateNewProductField('qualityStatus', e.target.value)}>
                            {QUALITY_OPTIONS.map(option => <option key={option.value || 'quality-empty'} value={option.value}>{option.label}</option>)}
                        </select>
                    </div>
                    <div className="col-12 col-md-3">
                        <label className="form-label small fw-bold text-secondary mb-1">Упаковка</label>
                        <select className="form-select bg-light border-0" value={newProduct.packagingType} onChange={e=>updateNewProductField('packagingType', e.target.value)}>
                            {PACKAGING_OPTIONS.map(option => <option key={option.value || 'packaging-empty'} value={option.value}>{option.label}</option>)}
                        </select>
                    </div>
                    <div className="col-12 col-md-3">
                        <label className="form-label small fw-bold text-secondary mb-1">Производитель</label>
                        <input className="form-control bg-light border-0" placeholder="Не указан" value={newProduct.manufacturer} onChange={e=>updateNewProductField('manufacturer', e.target.value)} />
                    </div>
                    <div className="col-12 col-md-3">
                        <label className="form-label small fw-bold text-secondary mb-1">Бренд</label>
                        <input className="form-control bg-light border-0" placeholder="Не указан" value={newProduct.brand} onChange={e=>updateNewProductField('brand', e.target.value)} />
                    </div>
                    <div className="col-12">
                        <label className="form-label small fw-bold text-secondary mb-1">Комментарий к товару</label>
                        <textarea className="form-control bg-light border-0 product-create-notes" placeholder="Можно оставить пустым" value={newProduct.notes} onChange={e=>updateNewProductField('notes', e.target.value)} />
                    </div>
                </div>
            </div>
        )}

        <div className="card toolbar-card shadow-sm p-3 p-md-4 mb-3 mb-md-4 border-0 rounded-4 bg-white">
            <input className="form-control rounded-pill px-4 bg-light border-0 toolbar-search" placeholder="🔍 Поиск по реестру..." onChange={e => setSearch(e.target.value)} />
            <div className="toolbar-actions">
                <RoundedSelect
                    className="toolbar-filter"
                    pill
                    value={selectedCategory}
                    options={buildCategoryOptions(categories, 'Все категории')}
                    placeholder="Все категории"
                    ariaLabel="Фильтр по категории"
                    onChange={(nextValue) => setSelectedCategory(nextValue)}
                />
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
                    {user?.role === 'SALES_MANAGER' && (
                        <button className="btn btn-outline-dark rounded-pill px-2 px-md-3 fw-bold small-btn toolbar-mobile-btn" onClick={openActivityJournal} title="Журнал изменений">
                            <span className="toolbar-mobile-icon" aria-hidden="true">📝</span>
                            <span className="toolbar-mobile-copy">
                                <span className="toolbar-mobile-title">ЖУРНАЛ</span>
                                <span className="toolbar-mobile-note">Изменения по товарам</span>
                            </span>
                        </button>
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
                                <th style={{width: '40px'}}>Фото</th>
                                <th>Наименование</th>
                                <th style={{width: '140px'}} className="d-none d-md-table-cell">Категория</th>
                                <th style={{width: '80px'}}>Остаток</th>
                                {user.role !== 'STOREKEEPER' && <th style={{width: '100px'}}>Цена</th>}
                                <th className="text-end pe-4" style={{width: '190px'}}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map(p => {
                                const nameError = getEditingErrorMessage(p.id, 'name');
                                const quantityError = getEditingErrorMessage(p.id, 'quantity');
                                const priceError = getEditingErrorMessage(p.id, 'price');

                                return (
                                <tr key={p.id}>
                                    <td data-label="Фото"><div className="product-img-container product-img-container-table"><img src={p.photoUrl || FALLBACK_IMAGE} className="product-img product-img-table" onError={e=>e.target.src=FALLBACK_IMAGE}/></div></td>
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
                                        {renderProductMeta(p)}
                                     </td>
                                    <td className="d-none d-md-table-cell" data-label="Категория">
                                        {user.role === 'STOREKEEPER' ? (
                                            <RoundedSelect
                                                compact
                                                value={getProductCategoryId(p)}
                                                options={buildCategoryOptions(categories)}
                                                placeholder="Выбор..."
                                                ariaLabel={`Выбор категории для товара ${p.name}`}
                                                onChange={(nextValue) => updateProduct({ ...p, category: { id: nextValue } }, 'category')}
                                            />
                                        ) : renderCategoryBadge(p.categoryName)}
                                    </td>
                                    <td data-label="Остаток">
                                        {user.role === 'STOREKEEPER' ? (
                                            <div className="product-edit-cell">
                                                <input type="text" inputMode="numeric" pattern="[0-9]*" className={`form-control form-control-sm w-100 border-0 bg-light fw-bold product-edit-input ${quantityError ? 'product-input-error' : ''}`} 
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
                                     <td className="text-end pe-2 pe-md-4" data-label="Действия">
                                         {user.role === 'STOREKEEPER' ? (
                                             renderStorekeeperActions(p)
                                        ) : renderReadonlyActions(p)}
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


