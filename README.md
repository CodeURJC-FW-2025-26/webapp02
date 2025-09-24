0# Secretos de Cocina

Una página web de recetas caseras.



## Development team

| Nombre completo         | Correo oficial de la URJC                | GitHub      |
|-------------------------|------------------------------------------|-------------|
| Fernán Rama Hombreiro   | f.rama.2024@alumnos.urjc.es              | [fernanrama](https://github.com/fernanrama) |
| Izan Calle Feijoo       | i.calle.2024@alumnos.urjc.es             | [IzanCalle](https://github.com/IzanCalle)   |
| Rubén Torres Rivero     | r.torresr.2024@alumnos.urjc.es           | [Ruben2843](https://github.com/Ruben2843)   |



## Coordination tools

No utilizamos Trello. 
Si incorporamos alguna herramienta, pondremos el enlace aquí.



## Functionality

###  Entities

- Entidad principal: Recipe  
  Atributos:  
  - id (identificador único, numérico)  
  - name (string)  
  - ingredients (string)    
  - category (string: dessert, starter, main dish, vegan)  
  - preparation_time (entero, en minutos)  
  - dificulty (string: fácil, media, difícil)  

- Entidad secundaria: Step  
  Atributos:  
  - id (identificador único, numérico)    
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
