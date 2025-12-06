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
});