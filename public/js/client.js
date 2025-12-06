console.log("Client script loaded correctly!");

document.addEventListener('DOMContentLoaded', () => {

    // Seleccionamos el formulario de recetas
    const forms = document.querySelectorAll('.needs-validation');

    // Bucle sobre los formularios y prevención del envío si hay errores
    Array.from(forms).forEach(form => {
        form.addEventListener('submit', event => {

            // 1. Validación Personalizada: Nombre con Mayúscula
            const nameInput = document.getElementById('recipeName');
            if (nameInput) {
                const nameValue = nameInput.value.trim();
                // Si no está vacío y la primera letra no es mayúscula
                if (nameValue.length > 0 && nameValue[0] !== nameValue[0].toUpperCase()) {
                    // Usamos la API de validación de HTML5 para marcar error custom
                    nameInput.setCustomValidity("El nombre debe comenzar con mayúscula.");
                } else {
                    // Limpiamos el error si cumple la condición
                    nameInput.setCustomValidity("");
                }
            }

            // 2. Comprobación general de validación de Bootstrap/HTML5
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }

            // 3. Añadimos la clase que hace que Bootstrap muestre los colores
            form.classList.add('was-validated');
        }, false);

        // BONUS: Validación en tiempo real (mientras escribes) para el Nombre
        const nameInput = document.getElementById('recipeName');
        if (nameInput) {
            nameInput.addEventListener('input', () => {
                const nameValue = nameInput.value.trim();
                if (nameValue.length > 0 && nameValue[0] !== nameValue[0].toUpperCase()) {
                    nameInput.setCustomValidity("El nombre debe comenzar con mayúscula.");
                    // Forzamos mostrar el error visualmente al momento
                    nameInput.classList.add('is-invalid');
                    nameInput.classList.remove('is-valid');
                } else {
                    nameInput.setCustomValidity("");
                    // Si ya se había validado antes, quitamos el error
                    nameInput.classList.remove('is-invalid');
                    if (document.querySelector('.was-validated')) {
                        nameInput.classList.add('is-valid');
                    }
                }
            });
        }
    });
});