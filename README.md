# Secretos de Cocina

A website for homemade recipes.


## Development team

| Full Name         | Official URJC email address                | GitHub      |
|-------------------------|------------------------------------------|-------------|
| Fernán Rama Hombreiro   | f.rama.2024@alumnos.urjc.es              | [fernanrama](https://github.com/fernanrama) |
| Izan Calle Feijoo       | i.calle.2024@alumnos.urjc.es             | [IzanCalle](https://github.com/IzanCalle)   |
| Rubén Torres Rivero     | r.torresr.2024@alumnos.urjc.es           | [Ruben2843](https://github.com/Ruben2843)   |



## Coordination tools

We do not use Trello.
If we incorporate any tool, we will add the link here.


## Functionality

###  Entities

- Main Entity: Recipe  
  Attributes:  
  - id (unique numeric identifier)  
  - name (string)
  - description (string describing the recipe)
  - ingredients (string)
  - category (string: dessert, starter, main dish, vegan)  
  - preparation_time (integer, in minutes)  
  - difficulty (string: easy, medium, dificult)
  - image (image file)

- Secondary Entity: Step  
  Attributes:  
  - id (unique numeric identifier) 
  - name (string, name of the step) 
  - order (integer, indicates the step number in the sequence)
  - description (detailed text of the step)  
  - image (optional, shows the result of that intermediate step)



### Images

- Each recipe may have one or several images showing the finished dish.
- Each step may include an image showing the intermediate state of the preparation.

### Categorization
We will use categorization queries for the recipes.
The user will be able to consult recipes according to their category:

- Starters 
- Main dish  
- Desserts  
- Vegans

### Search engine  
We will add a search bar to the website to make it easier to explore the different recipes.

## Practica 1

### Capturas de pantalla

### Participacion de los miembros

#### Rubén Torres Rivero

I have been working on the index.html, creating and improving its design to make it look nice and ensuring that the grid is responsive.
However, most of my work has been focused on the AñadirReceta.html page, as I was the one who created that page, the form, and the images on the right side.

5 most important commits:

  1. Creation of the form in the AñadirReceta.html: https://github.com/CodeURJC-FW-2025-26/webapp02/commit/96afaf88d0b151c30b76c58a8ba5ea5a2d8559bb
  2. Creation of the grid in the index.html: https://github.com/CodeURJC-FW-2025-26/webapp02/commit/1906256d8950cf646be112afbca4de00ecec0d34
  3. Achieve that the grid is responsive: https://github.com/CodeURJC-FW-2025-26/webapp02/commit/5da793c4ae0a8c309ba337b683dd247541c2015b
  4. Non- final decoration of the AñadirReceta.html: https://github.com/CodeURJC-FW-2025-26/webapp02/commit/613c454de76fecfe63e99ec2be19431934963813
  5. Delete of the edit and delete ingredient buttons (they were unnecessary): https://github.com/CodeURJC-FW-2025-26/webapp02/commit/65bc5ce655816af879e6af08448177cca71f8073

The 5 files I have worked on the most are:
  1. AñadirReceta.html (https://github.com/CodeURJC-FW-2025-26/webapp02/blob/main/A%C3%B1adirReceta.html)
  2. Index.html (https://github.com/CodeURJC-FW-2025-26/webapp02/blob/main/Index.html)
  3. Cocina.css (https://github.com/CodeURJC-FW-2025-26/webapp02/blob/main/Cocina.css)
  4. Pulpo.html (https://github.com/CodeURJC-FW-2025-26/webapp02/blob/main/Pulpo.html)
  5. PatatasBravas.html (https://github.com/CodeURJC-FW-2025-26/webapp02/blob/main/PatatasBravas.html)

#### Izan Calle Feijoo

I have been working in several areas of the page, trying to improve its design and to add functionalities, as well as creating the layout for the webpage. I have also worked in the detail page, especially in its firsts versions, looking up the content and creating and detailing de layout with flexbox. Also, I have reviewed all of the pages to check if everything was in the right place, trying to make it easy to use for the average user.

5 most important commits:

  1. Creation of the navigation bar and top layout in the main page: https://github.com/CodeURJC-FW-2025-26/webapp02/commit/e8a3bfb4e46a2f997f76f9e50d200e0ca5f74374
  2. Creation of the "Añadir Receta" button and improvement of the CSS: https://github.com/CodeURJC-FW-2025-26/webapp02/commit/51a3bd785713f42916e876e5d1ba2a020f7f2979
  3. Color palette change and creation of the footer: https://github.com/CodeURJC-FW-2025-26/webapp02/commit/640b2bcfa7ff3851ddeaf907f47b5246c5d12e93
  4. Creation of the layout and content of the first 2 detail pages (Pulpo.html and PatatasBravas.html): https://github.com/CodeURJC-FW-2025-26/webapp02/commit/b9c6be3757ead0e74e4c3ad2009423e9988d9ecc
  5. Change in the style of the top header, including font style: https://github.com/CodeURJC-FW-2025-26/webapp02/commit/9e9be4fdfc60c73f56b103cdf08d2fd23d5abddd

The 5 files I have worked on the most are:

  1. Index.html: https://github.com/CodeURJC-FW-2025-26/webapp02/blob/main/Index.html
  2. Cocina.css: https://github.com/CodeURJC-FW-2025-26/webapp02/blob/main/Cocina.css
  3. Pulpo.html: https://github.com/CodeURJC-FW-2025-26/webapp02/blob/main/Pulpo.html
  4. PatatasBravas.html: https://github.com/CodeURJC-FW-2025-26/webapp02/blob/main/PatatasBravas.html
  5. Añadir receta.html: https://github.com/CodeURJC-FW-2025-26/webapp02/blob/main/A%C3%B1adirReceta.html

#### Fernán Rama Hombreiro

