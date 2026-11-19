(function () {
  try {
    var saved = localStorage.getItem('openndr_theme');
    var theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
