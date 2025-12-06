/* webapp02/public/js/client.js */

/**
 * Main Client-Side Logic
 * Handles Recipe Forms, Drag & Drop, Infinite Scroll, and Dynamic Step Management via AJAX.
 */

console.log("Client script loaded successfully.");

document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    //  HELPER FUNCTIONS (UI & UTILITIES)
    // ============================================================

    /**
     * Toggles the full-screen loading spinner.
     * @param {boolean} show - True to show, false to hide.
     */
    const toggleSpinner = (show) => {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            show ? spinner.classList.remove('d-none') : spinner.classList.add('d-none');
        }
    };

    /**
     * Displays the generic Bootstrap Feedback Modal.
     * @param {string} title - Modal Title.
     * @param {string} message - Body text.
     * @param {string} type - 'success' or 'error' (determines color).
     * @param {object} options - Configuration for buttons { showActionBtn, actionUrl, actionText, closeBtnText }.
     */
    const showFeedbackModal = (title, message, type, options = {}) => {
        const modalEl = document.getElementById('feedbackModal');
        if (!modalEl) return; // Safety check

        const modal = new bootstrap.Modal(modalEl);
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalActionBtn = document.getElementById('modalActionBtn');
        const modalCloseBtn = document.getElementById('modalCloseBtn');

        // Set content and style
        modalTitle.textContent = title;
        modalBody.textContent = message;
        modalTitle.className = type === 'success' ? "modal-title text-success" : "modal-title text-danger";

        // Configure Action Button (e.g., "View Recipe")
        if (options.showActionBtn) {
            modalActionBtn.classList.remove('d-none');
            modalActionBtn.textContent = options.actionText || "Continue";
            modalActionBtn.href = options.actionUrl || '#';
            if (modalCloseBtn) modalCloseBtn.classList.add('d-none'); // Hide close button if action is mandatory
        } else {
            modalActionBtn.classList.add('d-none');
            if (modalCloseBtn) {
                modalCloseBtn.classList.remove('d-none');
                modalCloseBtn.textContent = options.closeBtnText || "Close";
            }
        }

        modal.show();
    };

    // ============================================================
    //  MODULE 1: RECIPE FORM MANAGEMENT (CREATE / EDIT)
    // ============================================================

    const recipeForm = document.getElementById('recipeForm');

    if (recipeForm) {
        // 1.1 Detect Recipe ID for duplicate checking (exclude current ID on edit)
        let recipeId = null;
        const actionUrl = recipeForm.getAttribute('action');
        if (actionUrl && actionUrl.includes('/editar/')) {
            recipeId = actionUrl.split('/').pop();
        }

        // 1.2 Real-time Title Validation (Debounced AJAX)
        const nameInput = document.getElementById('recipeName');
        let debounceTimeout = null;

        if (nameInput) {
            nameInput.addEventListener('input', () => {
                const nameValue = nameInput.value.trim();
                clearTimeout(debounceTimeout);

                // Sync Validation: Uppercase check
                if (nameValue.length > 0 && nameValue[0] !== nameValue[0].toUpperCase()) {
                    nameInput.setCustomValidity("The name must start with an uppercase letter.");
                    nameInput.classList.add('is-invalid');
                    nameInput.classList.remove('is-valid');
                    return;
                } else {
                    nameInput.setCustomValidity(""); // Reset
                    nameInput.classList.remove('is-invalid');
                }

                // Async Validation: Check duplicates
                if (nameValue.length > 0) {
                    debounceTimeout = setTimeout(async () => {
                        try {
                            const params = new URLSearchParams({ title: nameValue });
                            if (recipeId) params.append('id', recipeId);

                            const response = await fetch(`/api/check-title?${params.toString()}`);

                            if (!response.headers.get("content-type")?.includes("application/json")) {
                                throw new Error("Invalid server response (Not JSON)");
                            }

                            const data = await response.json();

                            if (data.exists) {
                                nameInput.setCustomValidity("This recipe name already exists.");
                                nameInput.classList.add('is-invalid');
                                nameInput.classList.remove('is-valid');
                                // Update feedback text dynamically if element exists
                                const feedbackDiv = nameInput.nextElementSibling;
                                if (feedbackDiv && feedbackDiv.classList.contains('invalid-feedback')) {
                                    feedbackDiv.textContent = "This title is already in use. Please choose another.";
                                }
                            } else {
                                nameInput.setCustomValidity("");
                                nameInput.classList.remove('is-invalid');
                                nameInput.classList.add('is-valid');
                            }
                        } catch (error) {
                            console.error("Error validating title:", error);
                        }
                    }, 500); // 500ms debounce
                }
            });
        }

        // 1.3 Image Drag & Drop Logic
        const dropZone = document.getElementById('drop-zone');
        const imageInput = document.getElementById('recipeImage');
        const previewContainer = document.getElementById('image-preview-container');
        const removeImageFlag = document.getElementById('removeImageFlag');

        if (dropZone && imageInput) {

            // Highlight helpers
            const highlight = () => dropZone.classList.add('bg-light', 'border-primary');
            const unhighlight = () => dropZone.classList.remove('bg-light', 'border-primary');

            // Event Listeners for Drop Zone
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            ['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, highlight, false));
            ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, unhighlight, false));

            // Handle Drop
            dropZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    imageInput.files = files; // Assign files to the hidden input
                    handleFiles(files[0]);
                }
            });

            // Handle Click (opens file explorer)
            dropZone.addEventListener('click', () => imageInput.click());

            // Handle Standard Input Change
            imageInput.addEventListener('change', function () {
                if (this.files.length > 0) handleFiles(this.files[0]);
            });

            // Image Processing & Preview
            const handleFiles = (file) => {
                if (!file.type.startsWith('image/')) {
                    alert("Only image files are allowed.");
                    return;
                }

                // Reset delete flag if user uploads a new one
                if (removeImageFlag) removeImageFlag.value = "false";

                const reader = new FileReader();
                reader.onload = (e) => {
                    previewContainer.innerHTML = `
                        <img src="${e.target.result}" class="img-thumbnail" style="max-width: 200px;">
                        <div class="mt-2">
                            <button type="button" class="btn btn-sm btn-danger" id="btnRemoveImage">Remove Image</button>
                        </div>
                    `;
                    previewContainer.classList.remove('d-none');

                    // Re-bind delete button
                    document.getElementById('btnRemoveImage').addEventListener('click', clearImage);
                };
                reader.readAsDataURL(file);
            };

            // Clear Image Logic
            const clearImage = (e) => {
                e.stopPropagation(); // Prevent bubbling to dropZone click
                imageInput.value = '';
                previewContainer.innerHTML = '';
                previewContainer.classList.add('d-none');
                if (removeImageFlag) removeImageFlag.value = "true"; // Signal backend to delete DB reference
            };

            // Bind initial delete button if it exists (edit mode)
            const initialRemoveBtn = document.getElementById('btnRemoveImage');
            if (initialRemoveBtn) initialRemoveBtn.addEventListener('click', clearImage);
        }

        // 1.4 Main Form Submission
        recipeForm.addEventListener('submit', async event => {
            event.preventDefault();
            event.stopPropagation();

            if (!recipeForm.checkValidity()) {
                recipeForm.classList.add('was-validated');
                return;
            }

            const submitBtn = recipeForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;

            // Disable UI to prevent double submission
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';
            toggleSpinner(true);

            try {
                const formData = new FormData(recipeForm);
                const url = recipeForm.getAttribute('action');

                const response = await fetch(url, {
                    method: 'POST',
                    body: formData
                });

                if (!response.headers.get("content-type")?.includes("application/json")) {
                    throw new Error("Invalid server response. HTML received instead of JSON.");
                }

                const result = await response.json();
                toggleSpinner(false);

                if (response.ok && result.success) {
                    showFeedbackModal("Success!", result.message, "success", {
                        showActionBtn: true,
                        actionText: "View Recipe",
                        actionUrl: result.redirectUrl || '/'
                    });
                } else {
                    showFeedbackModal("Error", result.message || "Unknown error occurred.", "error", {
                        closeBtnText: "Close and Fix"
                    });
                    // Re-enable button on error to allow retry
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;
                }

            } catch (error) {
                toggleSpinner(false);
                console.error("Critical Error:", error);
                alert("Communication error with the server.");
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        }, false);
    }

    // ============================================================
    //  MODULE 2: INFINITE SCROLL (INDEX PAGE)
    // ============================================================

    const recipeGrid = document.getElementById('recipe-grid');

    if (recipeGrid) {
        const nextPageInput = document.getElementById('next-page');
        let isLoading = false;

        const loadMoreRecipes = async () => {
            if (isLoading || !nextPageInput || !nextPageInput.value) return;

            isLoading = true;
            const scrollSpinner = document.getElementById('scroll-spinner');
            if (scrollSpinner) scrollSpinner.classList.remove('d-none');

            const nextPage = nextPageInput.value;
            const search = document.getElementById('initial-search')?.value || '';
            const category = document.getElementById('initial-category')?.value || '';

            try {
                // Build URL
                let url = `/?page=${nextPage}&format=json`;
                if (search) url += `&search=${encodeURIComponent(search)}`;
                if (category) url += `&category=${encodeURIComponent(category)}`;

                const response = await fetch(url);

                if (!response.ok) throw new Error("Network response was not ok");
                if (!response.headers.get("content-type")?.includes("application/json")) {
                    throw new Error("Server returned HTML instead of JSON. Stopping scroll.");
                }

                const data = await response.json();

                if (data.recipes && data.recipes.length > 0) {
                    data.recipes.forEach(recipe => {
                        const col = document.createElement('div');
                        col.className = 'col-12 col-sm-6 col-lg-4 recipe-card-container';
                        col.innerHTML = `
                            <a href='/receta/${recipe._id}'>
                                <img src="/uploads/${recipe.image}" alt="${recipe.name}">
                            </a>
                            <h3>${recipe.name}</h3>
                        `;
                        recipeGrid.appendChild(col);
                    });
                    nextPageInput.value = data.nextPage || '';
                } else {
                    nextPageInput.value = '';
                }

            } catch (error) {
                console.error("Error loading more recipes:", error);
            } finally {
                isLoading = false;
                if (scrollSpinner) scrollSpinner.classList.add('d-none');
            }
        };

        // Detect Scroll Position
        window.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            // Trigger when 100px from bottom
            if (scrollTop + clientHeight >= scrollHeight - 100) {
                loadMoreRecipes();
            }
        });
    }

    // ============================================================
    //  MODULE 3: DETAIL PAGE (RECIPE DELETE & STEPS)
    // ============================================================

    // 3.1 Delete Entire Recipe
    const deleteRecipeBtn = document.getElementById('btnDeleteRecipe');
    if (deleteRecipeBtn) {
        deleteRecipeBtn.addEventListener('click', event => {
            event.preventDefault();

            // Bootstrap Modal for Confirmation
            const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
            document.getElementById('confirmModalBody').textContent = "Are you sure you want to delete this recipe entirely?";
            const confirmBtn = document.getElementById('confirmModalBtn');

            confirmBtn.onclick = async () => {
                confirmModal.hide();
                toggleSpinner(true);

                const form = document.getElementById('deleteRecipeForm');

                try {
                    const response = await fetch(form.getAttribute('action'), { method: 'POST' });

                    if (!response.headers.get("content-type")?.includes("application/json")) {
                        throw new Error("Invalid server response on delete.");
                    }

                    const result = await response.json();
                    toggleSpinner(false);

                    if (result.success) {
                        window.location.href = result.redirectUrl;
                    } else {
                        showFeedbackModal("Error", result.message, "error");
                    }
                } catch (err) {
                    console.error(err);
                    toggleSpinner(false);
                    alert("An error occurred while deleting.");
                }
            };

            confirmModal.show();
        });
    }

    // 3.2 Add New Step
    const addStepForm = document.getElementById('addStepForm');
    if (addStepForm) {
        addStepForm.addEventListener('submit', async event => {
            event.preventDefault();

            if (!addStepForm.checkValidity()) {
                addStepForm.classList.add('was-validated');
                return;
            }

            toggleSpinner(true);

            try {
                const formData = new FormData(addStepForm);
                const data = Object.fromEntries(formData.entries());

                const response = await fetch(addStepForm.action, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (!response.headers.get("content-type")?.includes("application/json")) {
                    throw new Error("Invalid server response adding step.");
                }

                const result = await response.json();
                toggleSpinner(false);

                if (result.success) {
                    addStepForm.reset();
                    addStepForm.classList.remove('was-validated');

                    // Dynamic DOM Insertion
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
                            <a href="#" class="btn btn-sm btn-outline-primary btn-edit-step" data-step-id="${newStep._id}">
                                <i class="bi bi-pencil"></i>
                            </a>
                            <form class="delete-step-form" action="/receta/${result.recipeId}/paso/borrar/${newStep._id}" method="POST">
                                <button type="submit" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button>
                            </form>
                        </div>
                    `;
                    stepsList.appendChild(li);

                    // Remove "No steps" message if present
                    const noStepsMsg = document.getElementById('noStepsMessage');
                    if (noStepsMsg) noStepsMsg.remove();

                    showFeedbackModal("Success!", result.message, "success", { closeBtnText: "OK" });

                } else {
                    showFeedbackModal("Error", result.message, "error");
                }

            } catch (err) {
                console.error(err);
                toggleSpinner(false);
            }
        });
    }

    // ============================================================
    //  MODULE 4: DYNAMIC STEP MANAGEMENT (DELETE & EDIT INLINE)
    // ============================================================

    const stepsList = document.getElementById('stepsList');
    if (stepsList) {

        // 4.1 Delete Step (Event Delegation)
        stepsList.addEventListener('submit', async event => {
            if (event.target.classList.contains('delete-step-form')) {
                event.preventDefault();
                const form = event.target;

                // Confirmation Modal
                const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
                document.getElementById('confirmModalBody').textContent = "Are you sure you want to delete this step?";
                const confirmBtn = document.getElementById('confirmModalBtn');

                confirmBtn.onclick = async () => {
                    confirmModal.hide();

                    try {
                        const response = await fetch(form.action, { method: 'POST' });
                        if (!response.headers.get("content-type")?.includes("application/json")) {
                            throw new Error("Invalid server response deleting step.");
                        }
                        const result = await response.json();

                        if (result.success) {
                            // Animation: Fade out
                            const li = form.closest('li');
                            li.classList.add('fade-out');

                            // Remove after animation
                            setTimeout(() => {
                                li.remove();

                                // Check if list is empty
                                if (stepsList.children.length === 0) {
                                    const p = document.createElement('p');
                                    p.className = "mt-3 text-muted";
                                    p.id = "noStepsMessage";
                                    p.textContent = "This recipe has no steps yet.";
                                    stepsList.parentNode.insertBefore(p, stepsList.nextSibling);
                                }
                            }, 500);
                        } else {
                            alert("Error deleting step: " + result.message);
                        }
                    } catch (err) { console.error(err); }
                };

                confirmModal.show();
            }
            // 4.3 Handle Inline Edit Submit
            else if (event.target.classList.contains('edit-step-form')) {
                event.preventDefault();
                const form = event.target;

                if (!form.checkValidity()) {
                    form.classList.add('was-validated');
                    return;
                }

                toggleSpinner(true);

                try {
                    const formData = new FormData(form);
                    const data = Object.fromEntries(formData.entries());

                    const response = await fetch(form.action, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    if (!response.headers.get("content-type")?.includes("application/json")) {
                        throw new Error("Invalid server response editing step.");
                    }

                    const result = await response.json();
                    toggleSpinner(false);

                    if (result.success) {
                        const li = form.closest('li');
                        const recipeIdUrl = window.location.pathname.split('/')[2];
                        const stepId = form.action.split('/').pop();

                        // Restore standard view with updated data
                        li.innerHTML = `
                            <div class="ms-2 me-auto">
                                <div class="fw-bold step-name">${result.step.name}</div>
                                <span class="step-desc">${result.step.description}</span>
                            </div>
                            <div class="d-flex gap-2">
                                <a href="#" class="btn btn-sm btn-outline-primary btn-edit-step" data-step-id="${stepId}">
                                    <i class="bi bi-pencil"></i>
                                </a>
                                <form class="delete-step-form" action="/receta/${recipeIdUrl}/paso/borrar/${stepId}" method="POST">
                                    <button type="submit" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button>
                                </form>
                            </div>
                        `;
                    } else {
                        alert("Error: " + result.message);
                    }
                } catch (err) {
                    console.error(err);
                    toggleSpinner(false);
                }
            }
        });

        // 4.2 Inline Edit Mode Toggle
        stepsList.addEventListener('click', async event => {
            const editBtn = event.target.closest('.btn-edit-step');
            const cancelBtn = event.target.closest('.btn-cancel-edit');

            // Activate Edit Mode
            if (editBtn) {
                event.preventDefault();
                const li = editBtn.closest('li');
                const stepId = editBtn.dataset.stepId;

                // Retrieve current values
                const currentName = li.querySelector('.step-name').textContent;
                const currentDesc = li.querySelector('.step-desc').textContent;

                // Store original HTML for cancel action
                li.dataset.originalHtml = li.innerHTML;

                // Inject Form
                const recipeIdUrl = window.location.pathname.split('/')[2];
                const actionUrl = `/receta/${recipeIdUrl}/paso/editar/${stepId}`;

                li.innerHTML = `
                    <form action="${actionUrl}" method="POST" class="w-100 edit-step-form needs-validation" novalidate>
                        <div class="mb-2">
                            <input type="text" class="form-control form-control-sm" name="stepName" value="${currentName}" required>
                            <div class="invalid-feedback">Title is required.</div>
                        </div>
                        <div class="mb-2">
                            <textarea class="form-control form-control-sm" name="stepDescription" rows="2" required>${currentDesc}</textarea>
                            <div class="invalid-feedback">Description is required.</div>
                        </div>
                        <div class="d-flex justify-content-end gap-2">
                            <button type="button" class="btn btn-sm btn-dark btn-cancel-edit">Cancel</button>
                            <button type="submit" class="btn btn-sm btn-dark">Save</button>
                        </div>
                    </form>
                `;
            }

            // Cancel Edit Mode
            if (cancelBtn) {
                const li = cancelBtn.closest('li');
                if (li.dataset.originalHtml) {
                    li.innerHTML = li.dataset.originalHtml;
                }
            }
        });
    }
});