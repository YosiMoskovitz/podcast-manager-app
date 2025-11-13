import { Languages } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { language, changeLanguage } = useLanguage();
  const { t } = useTranslation();
  
  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'he' : 'en';
    changeLanguage(newLang);
  };
  
  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
      title={t('settings.language.label')}
    >
      <Languages className="w-4 h-4" />
      <span>{language === 'en' ? 'EN' : 'עב'}</span>
    </button>
  );
}

export default LanguageSwitcher;
