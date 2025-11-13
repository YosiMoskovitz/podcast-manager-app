# Translation Quick Reference

## Common Patterns

### 1. Basic Translation
```jsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('dashboard.title')}</h1>;
}
```

### 2. Navigation Items
```jsx
const navItems = [
  { path: '/', icon: Home, label: t('nav.dashboard') },
  { path: '/podcasts', icon: Radio, label: t('nav.podcasts') },
  { path: '/episodes', icon: List, label: t('nav.episodes') }
];
```

### 3. Buttons with Loading States
```jsx
<button>
  {loading ? t('common.loading') : t('common.save')}
</button>

<button>
  {checking ? t('dashboard.actions.checking') : t('dashboard.actions.checkNow')}
</button>
```

### 4. Status Badges
```jsx
<span>{t('dashboard.drive.connected')}</span>
<span>{t('dashboard.drive.notConnected')}</span>
```

### 5. With Interpolation (Dynamic Values)
```jsx
t('dashboard.verification.missingFiles', { count: 5 })
// Result: "Found 5 episode(s) missing from Drive"

t('settings.system.autoCheck.description', { hours: 24 })
// Result: "When enabled, your podcasts will be checked automatically every 24 hours..."
```

### 6. Concatenated Text
```jsx
// For dynamic subtitles
subtitle={`${stats?.activePodcasts || 0} ${t('podcasts.status.active').toLowerCase()}`}
// Result: "5 active"
```

### 7. Form Labels
```jsx
<label>{t('settings.system.maxEpisodes.label')}</label>
<input type="number" />
<p className="text-xs">{t('settings.system.maxEpisodes.description')}</p>
```

### 8. Conditional Text
```jsx
{driveStatus.status === 'active' 
  ? t('dashboard.drive.connected') 
  : t('dashboard.drive.notConnected')
}
```

## Translation Keys Structure

### Common Section (common.*)
- `loading`, `save`, `cancel`, `delete`, `edit`, `close`
- `confirm`, `yes`, `no`, `search`, `filter`
- `export`, `import`, `refresh`, `settings`, `logout`

### Navigation (nav.*)
- `dashboard`, `podcasts`, `episodes`, `statistics`, `settings`

### Dashboard (dashboard.*)
- `title`
- `stats.*` - activePodcasts, totalEpisodes, downloaded, pending, failed, storageUsed
- `actions.*` - checkNow, checking, verifyFiles, verifying, retryFailed
- `sync.*` - inProgress, started, alreadyRunning, failed
- `drive.*` - connected, notConnected, status
- `verification.*` - allSynced, missingFiles, failed

### Settings (settings.*)
- `title`
- `system.*` - System settings section
- `drive.*` - Google Drive integration
- `data.*` - Data management
- `language.*` - Language options

## RTL-Aware Components

### Check Current Direction
```jsx
import { useLanguage } from '../contexts/LanguageContext';

function MyComponent() {
  const { isRTL } = useLanguage();
  
  // Use in conditional styling
  return (
    <div className={isRTL ? 'text-right' : 'text-left'}>
      Content
    </div>
  );
}
```

### Manual Language Switch
```jsx
import { useLanguage } from '../contexts/LanguageContext';

function MyComponent() {
  const { changeLanguage } = useLanguage();
  
  return (
    <button onClick={() => changeLanguage('he')}>
      Switch to Hebrew
    </button>
  );
}
```

## Adding New Translations

### Step 1: Add to en.json
```json
{
  "myFeature": {
    "title": "My Feature",
    "description": "This is a description",
    "action": "Do Something"
  }
}
```

### Step 2: Add to he.json
```json
{
  "myFeature": {
    "title": "התכונה שלי",
    "description": "זה תיאור",
    "action": "עשה משהו"
  }
}
```

### Step 3: Use in Component
```jsx
import { useTranslation } from 'react-i18next';

function MyFeature() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('myFeature.title')}</h1>
      <p>{t('myFeature.description')}</p>
      <button>{t('myFeature.action')}</button>
    </div>
  );
}
```

## Debugging Tips

### 1. Missing Translation
If you see a translation key instead of text:
- Check spelling in both JSON files
- Ensure the key exists in both en.json and he.json
- Restart dev server after adding new keys

### 2. Check Current Language
```jsx
const { i18n } = useTranslation();
console.log('Current language:', i18n.language);
```

### 3. Force Language
```jsx
const { i18n } = useTranslation();
i18n.changeLanguage('he'); // Force Hebrew
i18n.changeLanguage('en'); // Force English
```

### 4. List All Translation Keys (Development)
```jsx
const { i18n } = useTranslation();
console.log('All translations:', i18n.store.data);
```

## Best Practices

1. **Always translate UI text** - Never hardcode user-facing strings
2. **Use descriptive keys** - `dashboard.actions.checkNow` not `btn1`
3. **Group related translations** - Keep sections organized
4. **Test both languages** - Verify RTL layout and Hebrew text
5. **Keep translations in sync** - Update both files together
6. **Use interpolation** - For dynamic values in text
7. **Lowercase dynamic parts** - `.toLowerCase()` for consistency

## Common Mistakes to Avoid

❌ **Don't do this:**
```jsx
<button>Check Now</button>
```

✅ **Do this:**
```jsx
<button>{t('dashboard.actions.checkNow')}</button>
```

❌ **Don't do this:**
```jsx
const message = "User " + username + " logged in";
```

✅ **Do this:**
```jsx
const message = t('auth.loginMessage', { username });
// In JSON: "loginMessage": "User {{username}} logged in"
```
