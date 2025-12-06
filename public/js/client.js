/* public/js/client.js */

console.log("Client script loaded correctly!");

document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    //  SECTION 1: RECIPE FORM LOGIC (Create & Edit)
    // ============================================================
    const recipeForm = document.getElementById('recipeForm');

    if (recipeForm) {

        // 1. Detect Recipe ID (to avoid false duplicates when editing)
        let recipeId = null;
        const actionUrl = recipeForm.getAttribute('action');
        if (actionUrl && actionUrl.includes('/editar/')) {
            recipeId = actionUrl.split('/').pop();
        }

        // 2. Real-time Validation (Uppercase + AJAX Duplicate Check)
        const nameInput = document.getElementById('recipeName');
        let timeout = null; // Variable for debounce

        if (nameInput) {
            nameInput.addEventListener('input', () => {
                const nameValue = nameInput.value.trim();

                // Clear previous timeout to avoid saturating the server
                clearTimeout(timeout);

                // A) Synchronous Validation: Uppercase start
                if (nameValue.length > 0 && nameValue[0] !== nameValue[0].toUpperCase()) {
                    nameInput.setCustomValidity("El nombre debe comenzar con mayúscula.");
                    nameInput.classList.add('is-invalid');
                    nameInput.classList.remove('is-valid');
                    return; // If this fails, we don't proceed to AJAX
                } else {
                    // Reset momentarily
                    nameInput.setCustomValidity("");
                    nameInput.classList.remove('is-invalid');
                }

                // B) Asynchronous Validation (AJAX): Duplicate Title
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
                                // Update feedback text if the specific div exists
                                const feedbackDiv = nameInput.nextElementSibling;
                                if (feedbackDiv && feedbackDiv.classList.contains('invalid-feedback')) {
                                    feedbackDiv.textContent = "Este título ya está en uso. Elige otro.";
                                }
                            } else {
                                nameInput.setCustomValidity("");
                                nameInput.classList.remove('is-invalid');
                                nameInput.classList.add('is-valid'); // Green if everything is OK
                            }
                        } catch (error) {
                            console.error("Error validating title:", error);
                        }
                    }, 500); // Wait 500ms after user stops typing
                }
            });
        }

        // 3. Form Submission (AJAX Submit)
        recipeForm.addEventListener('submit', async event => {
            event.preventDefault(); // Stop traditional submission
            event.stopPropagation();

            // Final check of HTML5/Bootstrap validation
            if (!recipeForm.checkValidity()) {
                recipeForm.classList.add('was-validated');
                return; // Stop if there are errors
            }

            // Show Loading Spinner
            const spinner = document.getElementById('loadingSpinner');
            if (spinner) spinner.classList.remove('d-none');

            try {
                const formData = new FormData(recipeForm);
                const url = recipeForm.getAttribute('action');

                // Request to server
                const response = await fetch(url, {
                    method: 'POST',
                    body: formData
                });

                // Hide Spinner
                if (spinner) spinner.classList.add('d-none');

                // Process JSON response
                const result = await response.json();

                // Configure Feedback Modal
                const modalEl = document.getElementById('feedbackModal');
                if (modalEl) {
                    const modal = new bootstrap.Modal(modalEl);
                    const modalTitle = document.getElementById('modalTitle');
                    const modalBody = document.getElementById('modalBody');
                    const modalBtn = document.getElementById('modalActionBtn');

                    if (response.ok && result.success) {
                        // SUCCESS
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
                    // Fallback if no modal exists (just in case)
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

    // ============================================================
    //  SECTION 2: INFINITE SCROLL LOGIC (Index Page)
    // ============================================================

    // We look for the grid container. If it exists, we are on the Index page.
    const recipeGrid = document.getElementById('recipe-grid');

    if (recipeGrid) {
        const nextPageInput = document.getElementById('next-page');
        let isLoading = false; // Flag to prevent multiple simultaneous fetches

        // Function to fetch and render new recipes
        const loadMoreRecipes = async () => {
            // Check conditions: not currently loading AND there is a next page available
            if (isLoading || !nextPageInput || !nextPageInput.value) return;

            isLoading = true;

            // Show the specific scroll spinner (bottom of the page)
            const spinner = document.getElementById('scroll-spinner');
            if (spinner) spinner.classList.remove('d-none');

            // Get current state from hidden inputs
            const nextPage = nextPageInput.value;
            const search = document.getElementById('initial-search').value;
            const category = document.getElementById('initial-category').value;

            try {
                // Construct URL with JSON format parameter
                let url = `/?page=${nextPage}&format=json`;
                if (search) url += `&search=${encodeURIComponent(search)}`;
                if (category) url += `&category=${encodeURIComponent(category)}`;

                const response = await fetch(url);

                if (!response.ok) throw new Error("Network response was not ok");

                const data = await response.json();

                if (data.recipes && data.recipes.length > 0) {
                    // Iterate over recipes and append them to the DOM
                    data.recipes.forEach(recipe => {
                        const col = document.createElement('div');
                        // Use same Bootstrap classes as in Index.html
                        col.className = 'col-12 col-sm-6 col-lg-4 recipe-card-container';

                        // Template Literal to generate the Card HTML
                        col.innerHTML = `
                            <a href='/receta/${recipe._id}'>
                                <img src="/uploads/${recipe.image}" alt="${recipe.name}">
                            </a>
                            <h3>${recipe.name}</h3>
                        `;
                        recipeGrid.appendChild(col);
                    });

                    // Update the pointer for the next page (or empty string if null)
                    nextPageInput.value = data.nextPage || '';
                } else {
                    nextPageInput.value = ''; // Stop logic if no recipes returned
                }

            } catch (error) {
                console.error("Error loading more recipes:", error);
            } finally {
                // Always reset loading state and hide spinner
                isLoading = false;
                if (spinner) spinner.classList.add('d-none');
            }
        };

        // Scroll Event Listener
        window.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;

            // Trigger load when user is 100px from the bottom
            if (scrollTop + clientHeight >= scrollHeight - 100) {
                loadMoreRecipes();
            }
        });
    }

    // ============================================================
    //  SECCIÓN 3: PÁGINA DE DETALLE (Borrar y Pasos)
    // ============================================================

    // 1. Borrar Receta Principal
    const deleteRecipeBtn = document.getElementById('btnDeleteRecipe');
    if (deleteRecipeBtn) {
        deleteRecipeBtn.addEventListener('click', event => {
            event.preventDefault(); // Paramos el submit directo

            // Mostrar modal de confirmación
            const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
            document.getElementById('confirmModalBody').textContent = "¿Estás seguro de que quieres borrar esta receta completamente?";
            const confirmBtn = document.getElementById('confirmModalBtn');

            // Definimos qué pasa al confirmar
            confirmBtn.onclick = async () => {
                confirmModal.hide(); // Cerramos modal confirmación

                // Mostrar spinner
                document.getElementById('loadingSpinner').classList.remove('d-none');

                const form = document.getElementById('deleteRecipeForm');
                const url = form.getAttribute('action');

                try {
                    const response = await fetch(url, { method: 'POST' });
                    const result = await response.json();

                    document.getElementById('loadingSpinner').classList.add('d-none');

                    // Reutilizamos el feedbackModal para el resultado
                    // ... (Aquí puedes usar una función auxiliar para mostrar modales y no repetir código)
                    // Por brevedad:
                    if (result.success) {
                        alert("Receta eliminada"); // O usar el modal bonito
                        window.location.href = result.redirectUrl;
                    } else {
                        alert("Error: " + result.message);
                    }
                } catch (err) {
                    console.error(err);
                }
            };

            confirmModal.show();
        });
    }

    // 2. Añadir Paso (AJAX)
    const addStepForm = document.getElementById('addStepForm');
    if (addStepForm) {
        addStepForm.addEventListener('submit', async event => {
            event.preventDefault();
            event.stopPropagation();

            if (!addStepForm.checkValidity()) {
                addStepForm.classList.add('was-validated');
                return;
            }

            // Spinner...
            document.getElementById('loadingSpinner').classList.remove('d-none');

            try {
                // Preparamos datos JSON (o FormData, pero JSON es más limpio para datos simples)
                const formData = new FormData(addStepForm);
                const data = Object.fromEntries(formData.entries());

                const response = await fetch(addStepForm.action, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                document.getElementById('loadingSpinner').classList.add('d-none');

                if (result.success) {
                    // LIMPIAR FORMULARIO (Rúbrica punto 12)
                    addStepForm.reset();
                    addStepForm.classList.remove('was-validated');

                    // AÑADIR AL DOM (Rúbrica punto 12)
                    const stepsList = document.getElementById('stepsList');
                    const newStep = result.step;

                    const li = document.createElement('li');
                    li.className = "list-group-item d-flex justify-content-between align-items-center";
                    li.id = `step-${newStep._id}`;
                    li.innerHTML = `
                        <div class="ms-2 me-auto">
                            <div class="fw-bold step-name">${newStep.name}</div>
                            <span class="step-desc">${newStep.description}</span>
                        </div>
                        <div class="d-flex gap-2">
                            <a href="/receta/${result.recipeId}/paso/editar/${newStep._id}" class="btn btn-sm btn-outline-primary btn-edit-step" data-step-id="${newStep._id}">
                                <i class="bi bi-pencil"></i>
                            </a>
                            <form class="delete-step-form" action="/receta/${result.recipeId}/paso/borrar/${newStep._id}" method="POST">
                                <button type="submit" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button>
                            </form>
                        </div>
                    `;
                    stepsList.appendChild(li);

                    // Mostrar modal éxito
                    // showFeedbackModal("¡Éxito!", "Paso añadido correctamente", true); // Pseudo-código
                } else {
                    alert(result.message);
                }

            } catch (err) {
                console.error(err);
            }
        });
    }

    // 3. Borrar Paso (Delegación de eventos para que funcione en los nuevos pasos creados)
    const stepsList = document.getElementById('stepsList');
    if (stepsList) {
        stepsList.addEventListener('submit', async event => {
            if (event.target.classList.contains('delete-step-form')) {
                event.preventDefault();
                const form = event.target;

                if (!confirm("¿Borrar paso?")) return; // Simplificado, usar modal Bootstrap mejor

                try {
                    const response = await fetch(form.action, { method: 'POST' });
                    const result = await response.json();

                    if (result.success) {
                        // Eliminar del DOM (Rúbrica punto 14)
                        const li = form.closest('li');
                        li.remove();
                    }
                } catch (err) { console.error(err); }
            }
        });
    }
    // ============================================================
    //  SECCIÓN 4: EDICIÓN INLINE DE PASOS (Fase 5)
    // ============================================================

    // Usamos el mismo stepsList que ya teníamos
    if (stepsList) {

        // Delegación para el botón EDITAR
        stepsList.addEventListener('click', async event => {
            // Buscamos si el clic fue en el botón de editar (o en el icono dentro)
            const editBtn = event.target.closest('.btn-edit-step');

            if (editBtn) {
                event.preventDefault(); // Evitamos navegar al link

                const li = editBtn.closest('li');
                const stepId = editBtn.dataset.stepId;

                // 1. Obtener datos actuales
                const nameDiv = li.querySelector('.step-name');
                const descSpan = li.querySelector('.step-desc');

                const currentName = nameDiv.textContent;
                const currentDesc = descSpan.textContent;

                // 2. Guardar HTML original para poder "Cancelar"
                li.dataset.originalHtml = li.innerHTML;

                // 3. Reemplazar HTML con el formulario
                // NOTA: Usamos el mismo action que el link original tenía
                const recipeIdUrl = window.location.pathname.split('/')[2]; // /receta/ID/...
                const actionUrl = `/receta/${recipeIdUrl}/paso/editar/${stepId}`;

                li.innerHTML = `
                    <form action="${actionUrl}" method="POST" class="w-100 edit-step-form needs-validation" novalidate>
                        <div class="mb-2">
                            <input type="text" class="form-control form-control-sm" name="stepName" value="${currentName}" required>
                            <div class="invalid-feedback">El título es obligatorio.</div>
                        </div>
                        <div class="mb-2">
                            <textarea class="form-control form-control-sm" name="stepDescription" rows="2" required>${currentDesc}</textarea>
                            <div class="invalid-feedback">La descripción es obligatoria.</div>
                        </div>
                        <div class="d-flex justify-content-end gap-2">
                            <button type="button" class="btn btn-sm btn-secondary btn-cancel-edit">Cancelar</button>
                            <button type="submit" class="btn btn-sm btn-success">Guardar</button>
                        </div>
                    </form>
                `;
            }

            // Delegación para el botón CANCELAR (generado dinámicamente)
            const cancelBtn = event.target.closest('.btn-cancel-edit');
            if (cancelBtn) {
                const li = cancelBtn.closest('li');
                if (li.dataset.originalHtml) {
                    li.innerHTML = li.dataset.originalHtml; // Restaurar
                }
            }
        });

        // Delegación para el ENVÍO del formulario de edición (SUBMIT)
        stepsList.addEventListener('submit', async event => {
            if (event.target.classList.contains('edit-step-form')) {
                event.preventDefault();
                const form = event.target;

                // Validación Bootstrap
                if (!form.checkValidity()) {
                    form.classList.add('was-validated');
                    return;
                }

                // Mostrar Spinner
                document.getElementById('loadingSpinner').classList.remove('d-none');

                try {
                    const formData = new FormData(form);
                    // Convertir a JSON
                    const data = Object.fromEntries(formData.entries());

                    const response = await fetch(form.action, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    const result = await response.json();
                    document.getElementById('loadingSpinner').classList.add('d-none');

                    if (result.success) {
                        const li = form.closest('li');
                        const recipeIdUrl = window.location.pathname.split('/')[2];
                        const stepId = form.action.split('/').pop(); // Extraer ID de la URL

                        // Reconstruir el LI con los nuevos datos (formato visual)
                        li.innerHTML = `
                            <div class="ms-2 me-auto">
                                <div class="fw-bold step-name">${result.step.name}</div>
                                <span class="step-desc">${result.step.description}</span>
                            </div>
                            <div class="d-flex gap-2">
                                <a href="/receta/${recipeIdUrl}/paso/editar/${stepId}" class="btn btn-sm btn-outline-primary btn-edit-step" data-step-id="${stepId}">
                                    <i class="bi bi-pencil"></i>
                                </a>
                                <form class="delete-step-form" action="/receta/${recipeIdUrl}/paso/borrar/${stepId}" method="POST">
                                    <button type="submit" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button>
                                </form>
                            </div>
                        `;

                        // Opcional: Mostrar toast o modal pequeño de éxito
                    } else {
                        alert("Error: " + result.message);
                    }

                } catch (err) {
                    console.error(err);
                    document.getElementById('loadingSpinner').classList.add('d-none');
                }
            }
        });
    }
});