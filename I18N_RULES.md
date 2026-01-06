# I18N & TRANSLATION PROTOCOL FOR EXLI

## 🌍 Internationalization Rules

These rules MUST be followed for all future development to ensure seamless multi-language support.

---

### 1. No Hardcoded Text

**NEVER** write raw strings like:
```jsx
<div>Settings</div>
<button>Save Changes</button>
```

**ALWAYS** use translation keys:
```jsx
<div>{t('settings.title')}</div>
<button>{t('common.save')}</button>
```

---

### 2. Double Update Rule

When you create a **new text key** (e.g., `dashboard.welcome`), you **MUST** add it to **BOTH**:

1. `public/locales/en/translation.json`
2. `public/locales/he/translation.json` (Translate it or use a placeholder)

**Example:**
```json
// en/translation.json
{
  "dashboard": {
    "welcome": "Welcome to Exli"
  }
}

// he/translation.json
{
  "dashboard": {
    "welcome": "ברוכים הבאים ל-Exli"
  }
}
```

---

### 3. RTL Logic - Use Logical Properties

**NEVER** use physical direction classes:
- ❌ `ml-4`, `mr-4` (margin-left, margin-right)
- ❌ `pl-4`, `pr-4` (padding-left, padding-right)
- ❌ `left-0`, `right-0`
- ❌ `text-left`, `text-right`

**ALWAYS** use Logical Properties:
- ✅ `ms-4`, `me-4` (margin-start, margin-end)
- ✅ `ps-4`, `pe-4` (padding-start, padding-end)
- ✅ `start-0`, `end-0`
- ✅ `text-start`, `text-end`

**OR** use the `isRTL` flag from `useLanguage` hook for dynamic styling:
```jsx
const { isRTL } = useLanguage(userId);
<Icon className={isRTL ? 'ml-2' : 'mr-2'} />
```

---

### 4. Adding New Languages

To add a new language (e.g., Spanish):

1. Create folder: `public/locales/es/`
2. Copy `translation.json` from `en` and translate
3. Update `src/i18n.js`:
   ```js
   supportedLngs: ['en', 'he', 'es'],
   ```

---

### 5. Using the Translation Hook

Always import and use in components:

```jsx
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../hooks/useLanguage';

const MyComponent = ({ userId }) => {
  const { t } = useTranslation();
  const { language, setLanguage, isRTL } = useLanguage(userId);
  
  return (
    <div>
      <h1>{t('myComponent.title')}</h1>
    </div>
  );
};
```

---

### 6. Key Naming Convention

Use **nested, descriptive keys**:

```json
{
  "featureName": {
    "sectionName": {
      "elementType": "Text value"
    }
  }
}
```

**Example:**
```json
{
  "analytics": {
    "charts": {
      "title": "Monthly Overview",
      "noData": "No data available"
    },
    "filters": {
      "dateRange": "Date Range",
      "category": "Category"
    }
  }
}
```

---

### 7. Dynamic Values (Interpolation)

For dynamic content, use interpolation:

```json
{
  "welcome": "Hello, {{name}}!"
}
```

```jsx
t('welcome', { name: user.displayName })
```

---

### 8. Pluralization

For plural forms:

```json
{
  "items": "{{count}} item",
  "items_plural": "{{count}} items"
}
```

```jsx
t('items', { count: 5 }) // "5 items"
```

---

## 📁 File Structure

```
exli-front/
├── public/
│   └── locales/
│       ├── en/
│       │   └── translation.json
│       └── he/
│           └── translation.json
├── src/
│   ├── i18n.js              # i18n configuration
│   └── hooks/
│       └── useLanguage.js   # Language hook with Firebase sync
```

---

## 🔍 Checklist Before PR

- [ ] All new text uses `t()` function
- [ ] Translation keys added to ALL language files
- [ ] No physical direction classes (use logical properties)
- [ ] Tested in both LTR (English) and RTL (Hebrew) modes
- [ ] Language persists after page refresh

---

## 🚀 Quick Reference

| Task | Solution |
|------|----------|
| Display text | `{t('key.path')}` |
| Change language | `setLanguage('he')` |
| Check direction | `isRTL` from `useLanguage` |
| Margin start | `ms-4` instead of `ml-4` |
| Text alignment | `text-start` instead of `text-left` |
