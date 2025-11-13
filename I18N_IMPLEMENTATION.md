# Bilingual Support Implementation (English & Hebrew)

## Overview
This application now supports two languages: **English (EN)** and **Hebrew (HE)** with full RTL (right-to-left) layout support for Hebrew.

## Features Implemented

### 1. **i18n Infrastructure**
- ✅ React-i18next integration
- ✅ Browser language detection
- ✅ LocalStorage persistence
- ✅ Dynamic language switching

### 2. **Translation Files**
- **Location:** `src/locales/`
  - `en.json` - English translations
  - `he.json` - Hebrew translations

### 3. **Language Switcher**
- **Component:** `src/components/LanguageSwitcher.jsx`
- **Location:** Integrated in the sidebar (Layout component)
- **Functionality:** Toggle button showing "EN" or "עב" (Hebrew abbreviation)

### 4. **RTL Layout Support**
- **Dynamic Direction:** HTML `dir` attribute automatically switches between `ltr` and `rtl`
- **Language Attribute:** HTML `lang` attribute updates based on selected language
- **Tailwind CSS:** Compatible with RTL using logical properties
- **Automatic:** Direction changes apply immediately when language is switched

### 5. **Context Management**
- **LanguageContext:** `src/contexts/LanguageContext.jsx`
  - Manages current language state
  - Provides `isRTL` flag for components
  - Exposes `changeLanguage` function

## Usage

### For Users
1. **Find the language switcher** in the sidebar (below the app logo)
2. **Click the button** to toggle between English and Hebrew
3. **All UI text updates immediately** including:
   - Navigation menu
   - Page titles
   - Buttons and actions
   - Status messages
   - Form labels

### For Developers

#### Adding New Translations
1. **Add the key to both translation files:**
   ```json
   // src/locales/en.json
   {
     "mySection": {
       "myKey": "My English Text"
     }
   }
   
   // src/locales/he.json
   {
     "mySection": {
       "myKey": "הטקסט שלי בעברית"
     }
   }
   ```

2. **Use in components:**
   ```jsx
   import { useTranslation } from 'react-i18next';
   
   function MyComponent() {
     const { t } = useTranslation();
     
     return <div>{t('mySection.myKey')}</div>;
   }
   ```

#### Using Dynamic Values
```jsx
// With interpolation
t('dashboard.verification.missingFiles', { count: 5 })
// Result: "Found 5 episode(s) missing from Drive"
```

#### Checking Current Language
```jsx
import { useLanguage } from '../contexts/LanguageContext';

function MyComponent() {
  const { language, isRTL, changeLanguage } = useLanguage();
  
  return (
    <div>
      <p>Current language: {language}</p>
      <p>Is RTL: {isRTL ? 'Yes' : 'No'}</p>
      <button onClick={() => changeLanguage('he')}>Switch to Hebrew</button>
    </div>
  );
}
```

## Translation Coverage

### Currently Translated Pages
- ✅ **Layout & Navigation** - Fully translated
- ✅ **Dashboard** - Partially translated (main UI elements)
- ⚠️ **Login** - Translation keys ready
- ⚠️ **Podcasts** - Translation keys ready
- ⚠️ **Episodes** - Translation keys ready
- ⚠️ **Statistics** - Translation keys ready
- ⚠️ **Settings** - Translation keys ready

### To Complete Translation
For pages marked with ⚠️, follow these steps:

1. **Import the translation hook:**
   ```jsx
   import { useTranslation } from 'react-i18next';
   const { t } = useTranslation();
   ```

2. **Replace hardcoded strings:**
   ```jsx
   // Before
   <h1>Settings</h1>
   
   // After
   <h1>{t('settings.title')}</h1>
   ```

3. **Test both languages** to ensure proper display

## RTL Considerations

### Automatic Handling
- **Flexbox direction** automatically reverses
- **Text alignment** adjusts based on direction
- **Margins and padding** use logical properties
- **Icon positioning** within buttons adapts

### Manual RTL Adjustments (if needed)
For specific cases where you need RTL-aware styling:

```jsx
import { useLanguage } from '../contexts/LanguageContext';

function MyComponent() {
  const { isRTL } = useLanguage();
  
  return (
    <div className={isRTL ? 'text-right' : 'text-left'}>
      Content
    </div>
  );
}
```

## File Structure
```
src/
├── locales/
│   ├── en.json          # English translations
│   └── he.json          # Hebrew translations
├── contexts/
│   └── LanguageContext.jsx    # Language state management
├── components/
│   └── LanguageSwitcher.jsx   # Language toggle button
├── i18n.js              # i18next configuration
└── main.jsx             # App initialization with providers
```

## Dependencies Added
```json
{
  "i18next": "^23.x",
  "react-i18next": "^14.x",
  "i18next-browser-languagedetector": "^7.x"
}
```

## Browser Storage
Language preference is stored in:
- **LocalStorage key:** `i18nextLng`
- **Values:** `'en'` or `'he'`

## Testing Checklist
- [x] Build succeeds without errors
- [x] Language switcher appears in sidebar
- [x] Switching languages updates UI text
- [x] RTL direction applies for Hebrew
- [x] Language preference persists on page reload
- [ ] All pages fully translated (in progress)
- [ ] Toast messages translated
- [ ] Error messages translated

## Future Enhancements
1. **Complete all page translations** - Add `t()` calls to remaining components
2. **Date/time localization** - Format dates according to language
3. **Number formatting** - Locale-specific number formatting
4. **Additional languages** - Easy to add more languages by:
   - Creating new JSON file in `src/locales/`
   - Adding to `supportedLngs` in `src/i18n.js`
   - Updating language switcher UI

## Notes
- **Hebrew font support:** Ensure system fonts support Hebrew characters
- **Icon positioning:** Lucide icons work well with RTL
- **Testing:** Test thoroughly in both languages for UI consistency
- **Performance:** Translations are loaded synchronously (no lazy loading needed for 2 languages)
