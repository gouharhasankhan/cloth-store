// main.js - FashionHub Frontend Scripts

// Auto-dismiss alerts after 4 seconds
document.addEventListener('DOMContentLoaded', () => {
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    }, 4000);
  });
});

// Quantity increment/decrement helpers (optional)
function increaseQty(id) {
  const input = document.getElementById(id);
  input.value = parseInt(input.value) + 1;
}
function decreaseQty(id) {
  const input = document.getElementById(id);
  if (parseInt(input.value) > 1) input.value = parseInt(input.value) - 1;
}
