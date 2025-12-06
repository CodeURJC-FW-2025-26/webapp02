/* public/js/client.js */

console.log("Client script loaded correctly!");

document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA DEL FORMULARIO DE RECETAS ---
    const recipeForm = document.getElementById('recipeForm');

    if (recipeForm) {

        // 1. Detección del ID de la receta (para evitar falso duplicado al editar)
        let recipeId = null;
        const actionUrl = recipeForm.getAttribute('action');
        if (actionUrl && actionUrl.includes('/editar/')) {
            recipeId = actionUrl.split('/').pop();
        }

        // 2. Validación en Tiempo Real (Mayúsculas + Duplicado AJAX)
        const nameInput = document.getElementById('recipeName');
        let timeout = null; // Variable para el debounce

        if (nameInput) {
            nameInput.addEventListener('input', () => {
                const nameValue = nameInput.value.trim();

                // Limpiamos timeout anterior para no saturar al servidor
                clearTimeout(timeout);

                // A) Validación Síncrona: Mayúscula
                if (nameValue.length > 0 && nameValue[0] !== nameValue[0].toUpperCase()) {
                    nameInput.setCustomValidity("El nombre debe comenzar con mayúscula.");
                    nameInput.classList.add('is-invalid');
                    nameInput.classList.remove('is-valid');
                    return; // Si falla esto, no hacemos la petición AJAX
                } else {
                    // Reseteamos momentáneamente
                    nameInput.setCustomValidity("");
                    nameInput.classList.remove('is-invalid');
                }

                // B) Validación Asíncrona (AJAX): Título Duplicado
                if (nameValue.length > 0) {
                    timeout = setTimeout(async () => {
                        try {
                            const params = new URLSearchParams({ title: nameValue });
                            if (recipeId) params.append('id', recipeId);

                            const response = await fetch(`/api/check-title?${params.toString()}`);
                            const data = await response.json();

                            if (data.exists) {
                                nameInput.setCustomValidity("Este nombre de receta ya existe.");
                                nameInput.classList.add('is-invalid');
                                nameInput.classList.remove('is-valid');
                                // Actualizamos texto de feedback si existe el div específico
                                const feedbackDiv = nameInput.nextElementSibling;
                                if (feedbackDiv && feedbackDiv.classList.contains('invalid-feedback')) {
                                    feedbackDiv.textContent = "Este título ya está en uso. Elige otro.";
                                }
                            } else {
                                nameInput.setCustomValidity("");
                                nameInput.classList.remove('is-invalid');
                                nameInput.classList.add('is-valid'); // Verde si todo OK
                            }
                        } catch (error) {
                            console.error("Error validando título:", error);
                        }
                    }, 500); // Esperar 500ms tras dejar de escribir
                }
            });
        }

        // 3. Envío del Formulario (AJAX Submit)
        recipeForm.addEventListener('submit', async event => {
            event.preventDefault(); // Detener envío tradicional
            event.stopPropagation();

            // Verificación final de validación HTML5/Bootstrap
            if (!recipeForm.checkValidity()) {
                recipeForm.classList.add('was-validated');
                return; // Parar si hay errores
            }

            // Mostrar Spinner
            const spinner = document.getElementById('loadingSpinner');
            if (spinner) spinner.classList.remove('d-none');

            try {
                const formData = new FormData(recipeForm);
                const url = recipeForm.getAttribute('action');

                // Petición al servidor
                const response = await fetch(url, {
                    method: 'POST',
                    body: formData
                });

                // Ocultar Spinner
                if (spinner) spinner.classList.add('d-none');

                // Procesar respuesta JSON
                const result = await response.json();

                // Configurar Modal
                const modalEl = document.getElementById('feedbackModal');
                if (modalEl) {
                    const modal = new bootstrap.Modal(modalEl);
                    const modalTitle = document.getElementById('modalTitle');
                    const modalBody = document.getElementById('modalBody');
                    const modalBtn = document.getElementById('modalActionBtn');

                    if (response.ok && result.success) {
                        // ÉXITO
                        modalTitle.textContent = "¡Éxito!";
                        modalTitle.className = "modal-title text-success";
                        modalBody.textContent = result.message;

                        modalBtn.classList.remove('d-none');
                        modalBtn.textContent = "Ver Receta";
                        modalBtn.href = result.redirectUrl || '/';
                    } else {
                        // ERROR
                        modalTitle.textContent = "Error";
                        modalTitle.className = "modal-title text-danger";
                        modalBody.textContent = result.message || "Ha ocurrido un error desconocido.";

                        modalBtn.classList.add('d-none');
                    }
                    modal.show();
                } else {
                    // Fallback si no hay modal (por si acaso)
                    if (result.success) window.location.href = result.redirectUrl;
                    else alert(result.message);
                }

            } catch (error) {
                if (spinner) spinner.classList.add('d-none');
                console.error(error);
                alert("Error crítico de comunicación con el servidor");
            }
        }, false);
    }
});