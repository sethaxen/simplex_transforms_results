function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const isHidden = sidebar.classList.contains('hidden');
    if (isHidden) {
        sidebar.style.transform = 'translateX(0)';
    } else {
        sidebar.style.transform = 'translateX(-100%)';
    }
    sidebar.classList.toggle('hidden');
}
