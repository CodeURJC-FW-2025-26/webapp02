# Secretos de Cocina

Una página web de recetas caseras.



## Development team

| Full Name         | Official URJC email address                | GitHub      |
|-------------------------|------------------------------------------|-------------|
| Fernán Rama Hombreiro   | f.rama.2024@alumnos.urjc.es              | [fernanrama](https://github.com/fernanrama) |
| Izan Calle Feijoo       | i.calle.2024@alumnos.urjc.es             | [IzanCalle](https://github.com/IzanCalle)   |
| Rubén Torres Rivero     | r.torresr.2024@alumnos.urjc.es           | [Ruben2843](https://github.com/Ruben2843)   |



## Coordination tools

No utilizamos Trello.  
Si incorporamos alguna herramienta, pondremos el enlace aquí.



## Functionality

###  Entities

- Main Entity: Recipe  
  Attributes:  
  - id (identificador único, numérico)  
  - name (string)
  - description (string describiendo la receta)
  - ingredients (string)
  - category (string: dessert, starter, main dish, vegan)  
  - preparation_time (entero, en minutos)  
  - difficulty (string: fácil, media, difícil)
  - image (archivo de imagen)

- Secondary Entity: Step  
  Attributes:  
  - id (identificador único, numérico)  
  - name (string, nombre del paso)  
  - order (entero, indica el número de paso en la secuencia)  
  - description (texto detallado del paso)  
  - image (opcional, muestra el resultado de ese paso intermedio)  



### Images

- Cada receta podrá tener asociada una o varias imágenes que muestren el plato terminado.  
- Cada paso podrá incluir una imagen que muestre el estado intermedio de la preparación.  

### Categorization
Utilizaremos la consulta de categorización para las recetas.  
El usuario podrá consultar recetas según su categoría: 

- Starters 
- Main dish  
- Desserts  
- Vegans

### Search engine  
Añadiremos un buscador a la página web para facilitar la exploración de las distintas recetas
