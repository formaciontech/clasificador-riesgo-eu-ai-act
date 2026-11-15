/* Clasificador de riesgo · EU AI Act
   Orientación basada en el Reglamento (UE) 2024/1689, modificado por el
   Reglamento (UE) 2026/1744. No sustituye a un análisis jurídico.
   clasificar() no toca el navegador: en Node se exporta para probarla contra
   una tabla de casos con su resultado jurídico esperado.

   Versión autónoma del clasificador de https://formaciontech.es/clasificador-riesgo-ia/
   Revisión: 9 de noviembre de 2026. Las preguntas y la lógica son las de la web;
   solo cambian los enlaces del resultado (absolutos, sin la demo de la web) y la
   copia al portapapeles, que ahora funciona también al abrir el fichero en local.
   © 2026 José María Arroyo Sánchez · FormacionTech · Licencia MIT. */
(function () {
  'use strict';

  var estado = { paso: 0, r: {} };

  var PROHIBIDAS = [
    'Puntuación social: evaluar a personas por su conducta o sus rasgos, con un trato perjudicial o injustificado',
    'Técnicas subliminales o deliberadamente manipuladoras que causen perjuicio',
    'Explotación de vulnerabilidades por edad, discapacidad o situación social',
    'Categorización biométrica para inferir raza, opiniones políticas, afiliación sindical, creencias, vida u orientación sexual',
    'Inferir emociones de personas en el trabajo o en centros educativos, salvo que el sistema se instale por motivos médicos o de seguridad',
    'Extracción masiva no selectiva de imágenes faciales para crear bases de datos',
    'Predicción del riesgo de delinquir basada solo en perfilado o rasgos de personalidad',
    'Identificación biométrica remota en tiempo real en espacios públicos con fines policiales (salvo excepciones tasadas)',
    'Generación de imágenes íntimas de personas identificables sin su consentimiento',
    'Generación de material de abuso sexual infantil'
  ];

  var ANEXO_III = [
    'Biometría (identificación remota, categorización por rasgos sensibles y reconocimiento de emociones, también el permitido por motivos médicos o de seguridad; no la simple verificación de identidad)',
    'Infraestructuras críticas (componentes de seguridad en infraestructuras digitales, tráfico, agua, gas, electricidad, calefacción)',
    'Educación y formación (admisión, evaluación, detección de fraude en exámenes)',
    'Empleo (selección, cribado de candidaturas, promoción, asignación de tareas, evaluación del desempeño)',
    'Servicios esenciales (prestaciones públicas, solvencia crediticia de personas físicas salvo detección de fraude financiero, llamadas de emergencia)',
    'Seguros de vida y salud (evaluación de riesgos y fijación de precios)',
    'Aplicación de la ley',
    'Migración, asilo y control fronterizo',
    'Administración de justicia y procesos democráticos'
  ];

  function esProducto(r) { return r.producto === 'seguridad' || r.producto === 'producto'; }
  function enAnexo3(r) { return !!(r.anexo3 && r.anexo3.length && r.anexo3.indexOf('ninguno') === -1); }

  var PASOS = [
    {
      id: 'rol',
      titulo: '¿Cuál es tu relación con este sistema?',
      ayuda: 'El Reglamento impone obligaciones muy distintas según desarrolles el sistema o solo lo utilices. Responde pensando en un sistema concreto.',
      tipo: 'radio',
      opciones: [
        { v: 'proveedor', t: 'Lo desarrollamos para otros', d: 'Nosotros u otro por encargo nuestro, y lo comercializamos con nuestro nombre o marca' },
        { v: 'integrador', t: 'Lo construimos sobre un modelo o una API de otro', d: 'Por ejemplo, un chatbot propio sobre la API de un modelo de lenguaje' },
        { v: 'responsable', t: 'Usamos un sistema de otro proveedor', d: 'Lo contratamos o licenciamos y lo usamos bajo nuestra autoridad' },
        { v: 'ambos', t: 'Las dos cosas', d: 'Lo desarrollamos con nuestro nombre y además lo usamos en nuestra actividad' },
        { v: 'nose', t: 'No estoy seguro', d: 'Te doy las obligaciones de ambos papeles y lo aclaramos en el resultado' }
      ]
    },
    {
      id: 'cambios',
      titulo: '¿Qué hacéis con ese sistema de otro proveedor?',
      ayuda: 'Estas situaciones pueden convertirte en proveedor aunque no lo hayas desarrollado tú (artículos 3.3 y 25). Marca las que apliquen.',
      tipo: 'check',
      soloSi: function (r) { return r.rol === 'responsable' || r.rol === 'nose'; },
      opciones: [
        { v: 'marca', t: 'Le ponemos nuestro nombre o marca', d: 'Marca blanca o producto propio sobre un sistema ajeno' },
        { v: 'integra', t: 'Lo integramos en una aplicación o servicio nuestro', d: 'Lo ponemos en servicio dentro de algo que hemos construido nosotros' },
        { v: 'finalidad', t: 'Lo usamos para algo que su proveedor no prevé', d: 'Por ejemplo, un asistente generalista para filtrar currículos o evaluar a personas' },
        { v: 'modifica', t: 'Lo hemos modificado de forma sustancial', d: 'Cambios que no estaban previstos por el proveedor' },
        { v: 'ninguno', t: 'Nada de esto: lo usamos tal cual y para lo previsto', exclusivo: true }
      ]
    },
    {
      id: 'prohibidas',
      titulo: '¿El sistema hace alguna de estas cosas?',
      ayuda: 'Son las prácticas prohibidas del artículo 5. Marca todas las que apliquen; si ninguna, sigue adelante.',
      tipo: 'check',
      opciones: PROHIBIDAS.map(function (t, i) { return { v: 'p' + i, t: t }; })
    },
    {
      id: 'producto',
      titulo: '¿El sistema tiene relación con un producto regulado?',
      ayuda: 'Productos con legislación de armonización de la Unión (Anexo I), como productos sanitarios, juguetes, ascensores, máquinas o vehículos.',
      tipo: 'radio',
      opciones: [
        { v: 'seguridad', t: 'Es componente de seguridad de ese producto', d: 'Cumple una función de seguridad, o su fallo puede poner en peligro la salud o la seguridad' },
        { v: 'producto', t: 'El propio sistema es el producto regulado', d: 'Por ejemplo, un software que es en sí mismo un producto sanitario' },
        { v: 'auxiliar', t: 'Va en el producto, pero para funciones ajenas a la seguridad', d: 'Asistencia al usuario, rendimiento, eficiencia, automatización, comodidad o control de calidad, y su fallo no pone en peligro la salud ni la seguridad' },
        { v: 'no', t: 'No', d: 'No tiene relación con un producto regulado' }
      ]
    },
    {
      id: 'seccion',
      titulo: '¿De qué tipo de producto se trata?',
      ayuda: 'El Anexo I tiene dos secciones, y lo que te aplica cambia por completo entre una y otra.',
      tipo: 'radio',
      soloSi: esProducto,
      opciones: [
        { v: 'A', t: 'Sección A', d: 'Productos sanitarios y de diagnóstico in vitro, juguetes, ascensores, equipos radioeléctricos, equipos a presión, atmósferas explosivas, instalaciones por cable, equipos de protección individual, aparatos de gas, embarcaciones de recreo' },
        { v: 'B', t: 'Sección B', d: 'Máquinas, vehículos de motor, vehículos de dos o tres ruedas, vehículos agrícolas y forestales, aviación civil, equipos marinos, ferrocarril' },
        { v: 'nose', t: 'No lo sé' }
      ]
    },
    {
      id: 'tercero',
      titulo: '¿Ese producto debe pasar una evaluación de la conformidad por un tercero?',
      ayuda: 'Es la segunda condición del artículo 6.1: sin evaluación por un tercero, como un organismo notificado, el producto no te lleva al alto riesgo.',
      tipo: 'radio',
      soloSi: esProducto,
      opciones: [
        { v: 'si', t: 'Sí', d: 'Interviene un tercero por riesgos para la salud o la seguridad' },
        { v: 'otros', t: 'Sí, pero solo por otros riesgos', d: 'Por ejemplo, espectro radioeléctrico o interferencias que no afectan a la salud ni a la seguridad' },
        { v: 'no', t: 'No', d: 'El fabricante hace la evaluación por sí mismo' },
        { v: 'nose', t: 'No lo sé' }
      ]
    },
    {
      id: 'anexo3',
      titulo: '¿En cuál de estos ámbitos se usa?',
      ayuda: 'Son los usos del Anexo III. Marca los que correspondan.',
      tipo: 'check',
      opciones: ANEXO_III.map(function (t, i) { return { v: 'a' + i, t: t }; }).concat(
        [{ v: 'ninguno', t: 'En ninguno de estos ámbitos', exclusivo: true }])
    },
    {
      id: 'perfilado',
      titulo: '¿El sistema elabora perfiles de personas físicas?',
      ayuda: 'Es decir, usa datos personales para evaluar o predecir aspectos de una persona, como su rendimiento, situación económica, salud, intereses, fiabilidad o comportamiento (art. 4.4 del RGPD). Si lo hace, es alto riesgo siempre, sin excepción (art. 6.3).',
      tipo: 'radio',
      soloSi: enAnexo3,
      opciones: [
        { v: 'si', t: 'Sí' },
        { v: 'no', t: 'No' },
        { v: 'nose', t: 'No estoy seguro' }
      ]
    },
    {
      id: 'excepcion',
      titulo: '¿El sistema está destinado solo a alguna de estas funciones?',
      ayuda: 'El artículo 6.3 permite salir del alto riesgo si el sistema no plantea un riesgo importante y no influye sustancialmente en la decisión. Basta con una condición; marca todas las que apliquen.',
      tipo: 'check',
      soloSi: function (r) { return enAnexo3(r) && r.perfilado === 'no'; },
      opciones: [
        { v: 'procedimental', t: 'Una tarea de procedimiento limitada', d: 'Ordena, clasifica o formatea sin valorar' },
        { v: 'mejora', t: 'Mejorar el resultado de una actividad humana ya realizada', d: 'Revisa o pule un trabajo humano previo' },
        { v: 'patrones', t: 'Detectar patrones de toma de decisiones o desviaciones respecto a ellos', d: 'Compara con decisiones humanas anteriores, sin sustituir ni influir en la valoración humana sin una revisión adecuada' },
        { v: 'preparatoria', t: 'Una tarea preparatoria de una evaluación de estos ámbitos', d: 'Prepara información para que evalúe y decida una persona' },
        { v: 'ninguna', t: 'Ninguna: influye en la decisión', d: 'El resultado del sistema determina o condiciona la decisión', exclusivo: true }
      ]
    },
    {
      id: 'transparencia',
      titulo: '¿El sistema hace alguna de estas cosas?',
      ayuda: 'Determina las obligaciones de transparencia del artículo 50, que aplican desde el 2 de agosto de 2026.',
      tipo: 'check',
      opciones: [
        { v: 'interactua', t: 'Interactúa directamente con personas', d: 'Chatbots, asistentes, agentes conversacionales' },
        { v: 'sintetico', t: 'Genera texto, imagen, audio o vídeo sintéticos' },
        { v: 'deepfake', t: 'Genera ultrasuplantaciones (deepfakes) de personas, lugares o hechos reales' },
        { v: 'emociones', t: 'Reconoce emociones a partir de datos biométricos', d: 'Fuera de los contextos prohibidos' },
        { v: 'biometrica', t: 'Categoriza a personas a partir de datos biométricos', d: 'Fuera de los contextos prohibidos' },
        { v: 'ninguno', t: 'Ninguna de estas', exclusivo: true }
      ]
    },
    {
      id: 'gpai',
      titulo: '¿Desarrolláis un modelo de propósito general?',
      ayuda: 'Un modelo entrenado por vosotros, capaz de realizar tareas diversas. Usar la API de un modelo de otro no os convierte en proveedor de GPAI. Sus obligaciones son del modelo y no cambian el nivel de riesgo del sistema.',
      tipo: 'radio',
      opciones: [
        { v: 'si', t: 'Sí, entrenamos un modelo propio de propósito general' },
        { v: 'ajuste', t: 'Ajustamos un modelo de terceros', d: 'Fine-tuning sobre un modelo base ajeno' },
        { v: 'no', t: 'No', d: 'Usamos modelos de terceros tal cual, o no usamos modelos generativos' }
      ]
    }
  ];

  /* Solo cuentan las respuestas de las preguntas que siguen activas: si alguien vuelve atrás
     y cambia de opinión, lo contestado en una pregunta que ya no aplica deja de pesar. */
  function respuestasActivas(r) {
    var out = {};
    PASOS.forEach(function (p) {
      if ((!p.soloSi || p.soloSi(out)) && r[p.id] !== undefined) out[p.id] = r[p.id];
    });
    return out;
  }

  /* ---------- Papel efectivo ---------- */
  // El papel no depende solo de lo que se marca: el art. 25 lo cambia si el sistema acaba siendo de alto riesgo.
  function calcularPapel(r, alto) {
    var c = r.cambios || [];
    var marca = c.indexOf('marca') !== -1, integra = c.indexOf('integra') !== -1;
    var finalidad = c.indexOf('finalidad') !== -1, modifica = c.indexOf('modifica') !== -1;
    var p = { prov: false, desp: true, duda: false, motivos: [] };

    if (r.rol === 'proveedor') { p.prov = true; p.desp = false; }
    else if (r.rol === 'ambos') { p.prov = true; }
    else if (r.rol === 'integrador') {
      p.prov = true;
      p.motivos.push('Has construido el sistema sobre un modelo ajeno: si lo pones en servicio con tu nombre o marca, eres proveedor de ese sistema, aunque el modelo sea de otro, y responsable del despliegue si además lo usas (art. 3.3 y 3.4). El proveedor del modelo solo responde del modelo.');
    } else {
      if (r.rol !== 'responsable') { p.duda = true; p.prov = true; }
      if (integra) {
        p.prov = true;
        p.motivos.push('Si integras el sistema en un servicio tuyo y lo pones en servicio con tu nombre o marca, eres proveedor de ese resultado, aunque el modelo o el componente sean de otro (art. 3.3).');
      }
      if (marca) {
        p.prov = true;
        p.motivos.push(alto
          ? 'Al poner tu nombre o marca en un sistema de alto riesgo pasas a ser su proveedor, salvo que un contrato asigne las obligaciones de otro modo (art. 25.1 a).'
          : 'El art. 25 solo actúa sobre sistemas de alto riesgo, pero el art. 3.3 define como proveedor a quien pone un sistema en el mercado o en servicio con su nombre o marca. Con tu marca, trátate como proveedor salvo que el análisis jurídico diga otra cosa.');
      }
      if (alto && modifica) {
        p.prov = true;
        p.motivos.push('Al modificar sustancialmente un sistema de alto riesgo, sigues con un sistema de alto riesgo y pasas a ser su proveedor (art. 25.1 b).');
      }
      if (alto && finalidad) {
        p.prov = true;
        p.motivos.push('Al cambiar la finalidad prevista de un sistema que no era de alto riesgo, de modo que pasa a serlo, te conviertes en su proveedor, también si es un sistema de uso general (art. 25.1 c). El proveedor inicial deja de serlo para ese sistema y, salvo que hubiera excluido claramente esa transformación, debe cooperar contigo (art. 25.2).');
      }
    }
    return p;
  }

  /* ---------- Motor de clasificación ---------- */
  function clasificar(rEntrada) {
    var r = respuestasActivas(rEntrada || {});
    var res = { nivel: null, titulo: '', resumen: '', bloques: [] };

    // 1. Prohibido
    if (r.prohibidas && r.prohibidas.length) {
      res.nivel = 'prohibido';
      res.titulo = 'Riesgo inaceptable: práctica prohibida';
      res.resumen = 'Según lo que has marcado, el sistema encaja en alguna de las prácticas prohibidas del artículo 5. No es una cuestión de plazos ni de documentación: estas prácticas no pueden ponerse en el mercado ni utilizarse en la Unión Europea.';
      // p8 y p9 son las nuevas prohibiciones del Reglamento (UE) 2026/1744 (aplicables desde el 2/12/2026)
      var nuevas = r.prohibidas.filter(function (x) { return x === 'p8' || x === 'p9'; }).length;
      var fechaProh = nuevas === r.prohibidas.length
        ? 'Aplicable desde el 2 de diciembre de 2026 (nueva prohibición del Ómnibus Digital)'
        : (nuevas ? 'Aplicable desde el 2 de febrero de 2025; las nuevas prohibiciones, desde el 2 de diciembre de 2026'
                  : 'Aplicable desde el 2 de febrero de 2025');
      res.bloques.push({
        t: 'Qué hacer',
        fecha: fechaProh,
        items: [
          'Detener el despliegue o la comercialización del sistema.',
          'Revisar si la funcionalidad concreta puede eliminarse o rediseñarse.',
          'Documentar la decisión: las multas del artículo 99 llegan a 35.000.000,00 € o al 7,00 % del volumen de negocio mundial, si esta cifra es superior.',
          'Si crees que puede tratarse de un falso positivo de este cuestionario, contrástalo antes de actuar: las excepciones del artículo 5 son estrechas pero existen.'
        ]
      });
      return res;
    }

    var tr = (r.transparencia || []).filter(function (x) { return x !== 'ninguno'; });
    var trHay = function (v) { return tr.indexOf(v) !== -1; };

    // Vía del artículo 6.1 (Anexo I): las dos condiciones de 6.1, con los nuevos apartados 1 bis a 1 quater
    var viaProducto = esProducto(r);
    var altoAnexo1 = viaProducto && r.tercero === 'si';
    var dudaAnexo1 = viaProducto && (r.tercero === 'nose' || r.tercero === undefined);
    var anexo1B = altoAnexo1 && r.seccion === 'B';
    var anexo1Duda = altoAnexo1 && r.seccion !== 'A' && r.seccion !== 'B';

    // Vía del artículo 6.2 (Anexo III). El reconocimiento de emociones está en el punto 1 c) aunque no se marque
    var usoAnexo3 = enAnexo3(r);
    var emocionesImplicitas = trHay('emociones') && (r.anexo3 || []).indexOf('a0') === -1;
    var excepciones = (r.excepcion || []).filter(function (x) { return x !== 'ninguna'; });
    var exceptuado = usoAnexo3 && r.perfilado === 'no' && excepciones.length > 0 && !emocionesImplicitas;
    var altoAnexo3 = (usoAnexo3 || emocionesImplicitas) && !exceptuado;

    var alto = altoAnexo1 || altoAnexo3;
    var soloSeccionB = anexo1B && !altoAnexo3;   // art. 2.2: solo arts. 6.1, 60 bis y 102 a 112
    var p = calcularPapel(r, alto);
    var conAnexo3 = altoAnexo3;   // art. 6.3: con la excepción no hay alto riesgo por el Anexo III, aunque lo haya por el Anexo I

    // 2. Alto riesgo
    if (alto) {
      res.nivel = 'alto';
      res.titulo = 'Alto riesgo';
      if (altoAnexo1 && altoAnexo3) {
        res.resumen = 'El sistema encaja como alto riesgo por dos vías: la de los productos regulados del Anexo I y la de los usos del Anexo III. Por prudencia, toma como referencia el calendario más temprano de los dos.';
      } else if (anexo1B) {
        res.titulo = 'Alto riesgo por producto regulado (Anexo I, sección B)';
        res.resumen = 'El sistema se clasifica como alto riesgo por el artículo 6.1, pero su producto está en la sección B del Anexo I. Por eso no le aplica el capítulo III del Reglamento: únicamente le aplican los artículos 6.1, 60 bis y 102 a 112 (art. 2.2), y los requisitos llegarán a través de la legislación sectorial de ese producto.';
      } else if (altoAnexo1) {
        res.resumen = 'El sistema reúne las dos condiciones del artículo 6.1: es componente de seguridad de un producto del Anexo I, o es el propio producto, y ese producto debe pasar una evaluación de la conformidad por un tercero.' +
          (anexo1Duda ? ' Falta saber en qué sección del Anexo I está, y de eso depende lo que te aplica.' : ' Le aplican las obligaciones del capítulo III junto con la normativa sectorial del producto.');
      } else {
        res.resumen = 'El sistema se usa en un ámbito del Anexo III y no encaja en las excepciones del artículo 6.3, así que se clasifica como alto riesgo autónomo.';
      }
      if (emocionesImplicitas) {
        res.resumen += ' Has indicado que reconoce emociones: ese uso figura en el Anexo III, punto 1 c), aunque no hayas marcado el ámbito de biometría.';
      }
      if (r.perfilado === 'si') {
        res.resumen += ' Has indicado que elabora perfiles de personas: en ese caso el artículo 6.3 no permite ninguna excepción, aunque el sistema parezca auxiliar.';
      } else if (r.perfilado === 'nose' && altoAnexo3) {
        res.resumen += ' No has podido descartar que elabore perfiles de personas: mientras sea así, no puedes apoyarte en la excepción del artículo 6.3.';
      }
      if (dudaAnexo1) {
        res.resumen += ' Además, falta confirmar si el producto regulado debe pasar una evaluación de la conformidad por un tercero: eso añadiría la vía del artículo 6.1.';
      }

      if (soloSeccionB) {
        res.bloques.push({
          t: 'Qué te aplica',
          fecha: 'Según la legislación sectorial',
          items: [
            'Del Reglamento de IA, a este sistema solo le aplican el artículo 6.1, el artículo 60 bis sobre pruebas en condiciones reales y los artículos 102 a 112 (art. 2.2). Los artículos 57 a 59, solo si esos requisitos se integran en la norma sectorial.',
            'Los artículos 102 a 110 modifican las normas sectoriales y aplican desde el 27 de julio de 2026: los requisitos del capítulo III se tendrán en cuenta en los actos que se adopten en cada sector.',
            'En máquinas, el Reglamento (UE) 2023/1230 pasó a la sección B y los actos delegados sobre IA se aplicarán a más tardar el 2 de agosto de 2028.',
            'No dejes de vigilar los actos delegados y de ejecución de tu sector: ahí estarán las exigencias concretas.'
          ]
        });
      } else {
        var usaFecha3 = altoAnexo3;
        var itemsFecha = [
          usaFecha3
            ? 'Los sistemas del Anexo III aplican desde el 2 de diciembre de 2027, tras el aplazamiento del Ómnibus Digital. La fecha original era el 2 de agosto de 2026.'
            : 'Los sistemas de alto riesgo del artículo 6.1 y el Anexo I aplican desde el 2 de agosto de 2028, tras el aplazamiento del Ómnibus Digital. La fecha original era el 2 de agosto de 2027.',
          'Si el sistema ya estaba en el mercado o en servicio antes de esa fecha, solo le aplica si después sufre cambios significativos de diseño. Si está destinado a autoridades públicas, hay que cumplir a más tardar el 2 de agosto de 2030 (art. 111.2).',
          'El margen es real, pero construir el expediente técnico y el sistema de gestión de riesgos lleva tiempo.'
        ];
        if (anexo1Duda) {
          itemsFecha.push('Comprueba la sección del Anexo I. En la sección A aplican las obligaciones de abajo. En la sección B solo los artículos 6.1, 60 bis y 102 a 112, y los requisitos llegan por la legislación sectorial (art. 2.2).');
        }
        res.bloques.push({
          t: 'Cuándo te aplica',
          fecha: usaFecha3 ? '2 de diciembre de 2027' : '2 de agosto de 2028',
          items: itemsFecha
        });

        if (p.prov) {
          var oblProv = [
            'Sistema de gestión de riesgos documentado y mantenido durante todo el ciclo de vida (Art. 9).',
            'Gobernanza de datos: representatividad, sesgos, lagunas y calidad de los conjuntos de entrenamiento y validación (Art. 10).',
            'Documentación técnica y expediente completo antes de la puesta en el mercado (Art. 11 y Anexo IV).',
            'Registro automático de eventos durante el funcionamiento (Art. 12).',
            'Transparencia e instrucciones de uso para el responsable del despliegue (Art. 13).',
            'Supervisión humana efectiva, con capacidad real de intervenir (Art. 14).',
            'Precisión, robustez y ciberseguridad adecuadas al uso previsto (Art. 15).',
            'Sistema de gestión de la calidad y vigilancia poscomercialización (Arts. 17 y 72).',
            'Evaluación de conformidad, declaración UE y marcado CE antes de comercializar (Arts. 43, 47 y 48).'
          ];
          if (conAnexo3) oblProv.push('Registro del sistema en la base de datos de la UE (Art. 49.1).');
          if (altoAnexo1 && r.seccion === 'A') {
            oblProv.push('Si el sistema se comercializa bajo el nombre o la marca del fabricante del producto, el proveedor es ese fabricante (Art. 25.3). La Comisión debe concretar antes del 2 de agosto de 2027 qué obligaciones pueden limitarse cuando la norma sectorial ya protege igual o más (Art. 2.13).');
          }
          res.bloques.push({ t: 'Obligaciones como proveedor', items: oblProv });
        }
        if (p.desp) {
          var oblDesp = [
            'Usar el sistema conforme a las instrucciones del proveedor (Art. 26.1).',
            'Asignar la supervisión humana a personas con competencia, formación y autoridad suficientes (Art. 26.2).',
            'Garantizar que los datos de entrada son pertinentes y representativos para el uso previsto, si los controlas (Art. 26.4).',
            'Vigilar el funcionamiento y suspender el uso ante riesgos, notificando al proveedor y a la autoridad (Art. 26.5).',
            'Conservar los registros generados automáticamente durante al menos seis meses (Art. 26.6).',
            'Informar a los trabajadores y a sus representantes antes de usarlo en el lugar de trabajo (Art. 26.7).'
          ];
          if (conAnexo3) {
            oblDesp.push('Informar a las personas afectadas cuando el sistema intervenga en decisiones que les conciernan (Art. 26.11).');
            oblDesp.push('Evaluación de impacto en los derechos fundamentales (FRIA) si sois organismo de Derecho público o entidad privada que presta servicios públicos, o si usáis el sistema para scoring crediticio o para seguros de vida y salud (Anexo III, puntos 5.b y 5.c) (Art. 27).');
          }
          res.bloques.push({ t: 'Obligaciones como responsable del despliegue', items: oblDesp });
        }

        res.bloques.push({
          t: 'Por dónde empezar ya',
          items: [
            'Inventario: qué sistemas tenéis, quién los usa y con qué datos.',
            'Clasificación formal y documentada de cada uno, con su justificación.',
            'Análisis de distancia entre lo que existe hoy y lo que exigirá el capítulo III.',
            'Asignación de responsabilidades: quién responde de cada obligación dentro de la organización.'
          ]
        });
      }
    } else if (dudaAnexo1) {
      res.nivel = 'revisar';
      res.titulo = 'Posible alto riesgo: falta un dato';
      res.resumen = 'El sistema está en un producto regulado, pero el artículo 6.1 solo lo hace de alto riesgo si ese producto debe pasar una evaluación de la conformidad por un tercero. Hasta confirmarlo, no des por cerrada la clasificación.';
      res.bloques.push({
        t: 'Qué debes comprobar',
        items: [
          'Consulta en la legislación del producto si interviene un organismo notificado u otro tercero en la evaluación de la conformidad.',
          'Si interviene por riesgos para la salud o la seguridad, es alto riesgo: desde el 2 de agosto de 2028 en la sección A del Anexo I y por la vía sectorial en la sección B.',
          'Si solo interviene por otros riesgos, como el espectro radioeléctrico, no se cumple la condición (art. 6.1 quater). Si no interviene nadie, tampoco.'
        ]
      });
    } else if (exceptuado) {
      res.nivel = 'exceptuado';
      res.titulo = 'Uso del Anexo III con posible excepción';
      res.resumen = 'El sistema se usa en un ámbito del Anexo III, pero la función que has descrito encaja en las excepciones del artículo 6.3. Eso puede sacarlo del alto riesgo, con una condición importante: la excepción hay que documentarla y sostenerla, no basta con invocarla.';
    } else {
      res.nivel = tr.length ? 'limitado' : 'minimo';   // el modelo de propósito general no cambia el nivel del sistema
      res.titulo = 'Fuera del alto riesgo';
      res.resumen = 'Con lo que has indicado, el sistema no encaja ni en las prácticas prohibidas ni en las categorías de alto riesgo. Eso no significa que no te aplique nada: hay obligaciones que alcanzan a cualquier organización que use IA.';
    }

    // Excepción del 6.3: lo que toca hacer depende del papel. No se aplica al alto riesgo por producto regulado (art. 6.1):
    // ahí no hay nada que justificar sobre por qué «no es de alto riesgo».
    if (exceptuado && alto) {
      res.bloques.push({
        t: 'La excepción del artículo 6.3 no cambia este resultado',
        items: ['El uso del Anexo III encaja en una excepción, pero esa excepción solo vale para el Anexo III. El sistema sigue siendo de alto riesgo por el producto regulado (art. 6.1).']
      });
    }
    if (exceptuado && !alto) {
      if (p.prov) {
        res.bloques.push({
          t: 'Lo que exige la excepción al proveedor',
          fecha: 'Exigible desde el 2 de diciembre de 2027',
          items: [
            'Documentar la evaluación que justifica por qué el sistema no es de alto riesgo, antes de ponerlo en el mercado o en servicio (Art. 6.4).',
            'Registrar el sistema, y registrarse, en la base de datos de la UE aunque se aplique la excepción (Art. 49.2).',
            'Facilitar la documentación a las autoridades nacionales competentes si la piden (Art. 6.4).',
            'Revisar la evaluación si cambia el uso: la excepción decae en cuanto el sistema empieza a condicionar decisiones.',
            'Recordar que el perfilado de personas físicas anula la excepción de forma automática.'
          ]
        });
      }
      if (p.desp && !p.prov || p.duda) {
        res.bloques.push({
          t: 'Si solo usas el sistema',
          items: [
            'Documentar la evaluación y registrar el sistema corresponde a su proveedor (Arts. 6.4 y 49.2), no a quien lo usa.',
            'Pide al proveedor esa evaluación y comprueba que el uso que hacéis coincide con el evaluado.',
            'Si lo usáis de un modo que influye en las decisiones o elabora perfiles de personas, deja de valer la excepción y puedes pasar a ser proveedor (Art. 25.1 c).'
          ]
        });
      }
    }

    // Por qué el producto no lleva al alto riesgo
    if (r.producto === 'auxiliar') {
      res.bloques.push({
        t: 'Componente sin función de seguridad',
        items: [
          'Los sistemas usados únicamente para aspectos ajenos a la seguridad, como asistencia al usuario, optimización del rendimiento, eficiencia del servicio, automatización, comodidad o control de calidad, no se consideran componentes de seguridad (Art. 6.1 bis).',
          'Pero si su fallo o defecto de funcionamiento puede poner en peligro la salud y la seguridad, sí lo son (Art. 6.1 ter). Compruébalo antes de cerrar la clasificación.'
        ]
      });
    } else if (viaProducto && r.tercero === 'otros') {
      res.bloques.push({
        t: 'Evaluación por un tercero solo por otros riesgos',
        items: [
          'Se considera que no se cumple el artículo 6.1 b) cuando el producto solo debe pasar por un tercero debido a riesgos distintos de la salud y la seguridad, como el espectro radioeléctrico o las interferencias que no les afectan (Art. 6.1 quater).'
        ]
      });
    } else if (viaProducto && r.tercero === 'no') {
      res.bloques.push({
        t: 'Sin evaluación por un tercero',
        items: [
          'El artículo 6.1 exige dos condiciones a la vez. Sin evaluación de la conformidad por un tercero, falta la segunda y el producto no lleva al alto riesgo.',
          'Revísalo si cambia el producto o su procedimiento de evaluación: esa condición la fija la legislación sectorial.'
        ]
      });
    }

    // 3. Transparencia (aplica en todos los niveles no prohibidos, salvo la sección B: art. 2.2)
    if (tr.length && !soloSeccionB) {
      var itemsT = [];
      var prov = p.prov, desp = p.desp;
      var genera = trHay('sintetico') || trHay('deepfake');
      if (trHay('interactua')) {
        itemsT.push(prov
          ? 'Como proveedor: diseñar el sistema para que informe a la persona de que está interactuando con una IA, salvo que resulte evidente por el contexto (art. 50.1).'
          : 'Informar de que se habla con una IA es obligación del proveedor del sistema (art. 50.1). Comprueba que el aviso aparece en tu uso y no lo ocultes.');
      }
      if (genera) {
        itemsT.push(prov
          ? 'Como proveedor: marcar el contenido generado en formato legible por máquina, de forma que sea detectable como sintético (art. 50.2). Quedan fuera la edición estándar y lo que no altera sustancialmente los datos de entrada.'
          : 'El marcado legible por máquina corresponde al proveedor del sistema (art. 50.2). Pídele su plan.');
        if (prov) itemsT.push('Si el sistema ya estaba en el mercado antes del 2 de agosto de 2026, tienes hasta el 2 de diciembre de 2026 para cumplir el marcado del artículo 50.2 (art. 111.4).');
      }
      if (trHay('emociones') || trHay('biometrica')) {
        itemsT.push(desp
          ? 'Como responsable del despliegue: informar a las personas expuestas del funcionamiento del sistema de reconocimiento de emociones o categorización biométrica (art. 50.3).'
          : 'Informar a las personas expuestas corresponde a quien despliega el sistema (art. 50.3). Inclúyelo en las instrucciones de uso.');
      }
      if (trHay('biometrica')) {
        itemsT.push('Si esa categorización infiere rasgos sensibles o protegidos, además es un uso del Anexo III, punto 1 b), y puede ser de alto riesgo o incluso prohibido (art. 5.1 g).');
      }
      if (trHay('deepfake')) {
        itemsT.push(desp
          ? 'Como responsable del despliegue: indicar de forma visible que las ultrasuplantaciones han sido generadas o manipuladas artificialmente. En obras manifiestamente creativas, satíricas o de ficción basta con revelarlo sin estropear su disfrute (art. 50.4).'
          : 'Etiquetar las ultrasuplantaciones corresponde a quien despliega el sistema (art. 50.4). Dale los medios para hacerlo.');
      }
      if (trHay('sintetico') && desp) {
        itemsT.push('Como responsable del despliegue: si publicas textos generados con IA para informar al público sobre asuntos de interés público, indicarlo, salvo que una persona los revise y asuma la responsabilidad editorial (art. 50.4).');
      }
      res.bloques.push({ t: 'Obligaciones de transparencia (Art. 50)', fecha: '2 de agosto de 2026', items: itemsT, urgente: true });
    }

    // 4. GPAI: obligaciones del modelo, aparte del nivel de riesgo del sistema
    if (r.gpai === 'si') {
      res.bloques.push({
        t: 'Modelo de propósito general: obligaciones aparte',
        fecha: 'Aplicable desde el 2 de agosto de 2025',
        items: [
          'No es un nivel de riesgo del sistema: son obligaciones propias del modelo (capítulo V), sea cual sea el resultado de arriba.',
          'Documentación técnica del modelo y de su proceso de entrenamiento (Art. 53.1 a).',
          'Información y documentación para los proveedores que integren el modelo (Art. 53.1 b).',
          'Política de cumplimiento de la normativa de derechos de autor (Art. 53.1 c).',
          'Resumen público suficientemente detallado de los contenidos usados en el entrenamiento (Art. 53.1 d).',
          'Excepción: los modelos con licencia libre y de código abierto, con pesos y arquitectura públicos, no tienen que cumplir las dos primeras (Art. 53.2).',
          'Si el modelo presenta riesgo sistémico: evaluación, mitigación, notificación de incidentes graves y ciberseguridad reforzada, también con licencia abierta (Art. 55).',
          'Si el modelo ya estaba en el mercado antes del 2 de agosto de 2025, el plazo para cumplir acaba el 2 de agosto de 2027 (Art. 111.3).',
          'Las multas de la Comisión a proveedores de estos modelos aplican desde el 2 de agosto de 2026 (Art. 101).'
        ],
        urgente: true
      });
    } else if (r.gpai === 'ajuste') {
      res.bloques.push({
        t: 'Ajuste de modelos de terceros',
        items: [
          'El ajuste fino puede convertirte en proveedor del modelo resultante si modifica sustancialmente sus capacidades o su finalidad.',
          'Es una de las zonas grises más frecuentes: conviene documentar qué se ha modificado y con qué alcance, antes de que lo pregunte una autoridad.'
        ]
      });
    }

    // 5. Alfabetización: aplica siempre, salvo a un sistema que solo entra por la sección B (art. 2.2)
    if (soloSeccionB) {
      res.bloques.push({
        t: 'Lo que no te aplica por este sistema',
        items: [
          'Los artículos 4 y 50 no figuran entre los que el artículo 2.2 aplica a este sistema. Pueden seguir aplicándote por otros sistemas de IA de tu organización, de modo que clasifica cada uno por separado.'
        ]
      });
    } else {
      res.bloques.push({
        t: 'Alfabetización en IA (Art. 4)',
        fecha: 'Aplicable desde el 2 de febrero de 2025',
        items: [
          'Aplica a cualquier organización que desarrolle o use sistemas de IA, con independencia del nivel de riesgo.',
          'El Ómnibus la reformuló: ahora obliga a adoptar medidas para apoyar la promoción de la alfabetización, y aclara que no exige garantizar un nivel concreto en ninguna persona en particular.',
          'Sigue siendo exigible. Lo razonable es formación adaptada al papel de cada persona y evidencia documental de haberla impartido.'
        ]
      });
    }

    // 6. Papel: el aviso del art. 25 sale siempre
    var itemsPapel = p.motivos.slice();
    if (p.duda) itemsPapel.push('Como no tienes claro tu papel, arriba tienes las obligaciones de los dos. Quédate con las que te correspondan al aclararlo.');
    if (soloSeccionB) {
      itemsPapel.push('El artículo 25 no es uno de los que el artículo 2.2 aplica a este sistema: quién responde lo fija la legislación sectorial del producto.');
    } else {
      itemsPapel.push('Eres proveedor si desarrollas el sistema, o te lo desarrollan, y lo comercializas o lo pones en servicio con tu nombre o marca, aunque el modelo sea de otro (Art. 3.3).');
      itemsPapel.push('Eres responsable del despliegue si lo usas bajo tu autoridad en tu actividad profesional (Art. 3.4). Puedes ser las dos cosas a la vez.');
      itemsPapel.push('Puedes pasar de responsable a proveedor de un sistema de alto riesgo sin darte cuenta: poner tu marca, modificarlo sustancialmente o cambiar su finalidad prevista de modo que pase a serlo te convierte en proveedor (Art. 25.1). Reutilizar un asistente generalista para filtrar currículos es el caso típico.');
    }
    res.bloques.push({ t: 'Tu papel puede cambiar (Art. 25)', items: itemsPapel });

    return res;
  }

  // En Node no hay página: se exporta el motor para las pruebas
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = { clasificar: clasificar, PASOS: PASOS, respuestasActivas: respuestasActivas };
    return;
  }

  /* ---------- Interfaz ---------- */
  // Tras cambiar de pregunta o mostrar el resultado, el foco va al nuevo título (lectores de pantalla y teclado)
  function enfocar() {
    var t = app.querySelector('h2');
    if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  }
  var app = document.getElementById('clasificador');
  if (!app) return;

  function pasosActivos() {
    var r = respuestasActivas(estado.r);
    return PASOS.filter(function (p) { return !p.soloSi || p.soloSi(r); });
  }

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function render() {
    var activos = pasosActivos();
    if (estado.paso >= activos.length) return renderResultado();

    var p = activos[estado.paso];
    app.innerHTML = '';

    var barra = el('div', 'cl-progreso');
    var relleno = el('div', 'cl-progreso-fill');
    relleno.style.width = ((estado.paso) / activos.length * 100) + '%';
    barra.appendChild(relleno);
    app.appendChild(barra);

    app.appendChild(el('p', 'cl-contador', 'Pregunta ' + (estado.paso + 1) + ' de ' + activos.length));

    var h = el('h2', 'cl-pregunta', p.titulo);
    app.appendChild(h);
    if (p.ayuda) app.appendChild(el('p', 'cl-ayuda', p.ayuda));

    var grupo = el('div', 'cl-opciones');
    grupo.setAttribute('role', p.tipo === 'radio' ? 'radiogroup' : 'group');
    grupo.setAttribute('aria-label', p.titulo);

    p.opciones.forEach(function (o, i) {
      var id = p.id + '-' + i;
      var lab = el('label', 'cl-opcion');
      lab.setAttribute('for', id);
      var inp = document.createElement('input');
      inp.type = p.tipo === 'radio' ? 'radio' : 'checkbox';
      inp.name = p.id;
      inp.id = id;
      inp.value = o.v;

      var prev = estado.r[p.id];
      if (p.tipo === 'radio' && prev === o.v) inp.checked = true;
      if (p.tipo === 'check' && prev && prev.indexOf(o.v) !== -1) inp.checked = true;

      inp.addEventListener('change', function () {
        if (o.exclusivo && inp.checked) {
          grupo.querySelectorAll('input').forEach(function (x) { if (x !== inp) x.checked = false; });
        } else if (inp.checked) {
          grupo.querySelectorAll('input').forEach(function (x) {
            var op = p.opciones[parseInt(x.id.split('-').pop(), 10)];
            if (op && op.exclusivo) x.checked = false;
          });
        }
        actualizarBoton();
      });

      var caja = el('div', 'cl-opcion-txt');
      caja.appendChild(el('strong', null, o.t));
      if (o.d) caja.appendChild(el('span', null, o.d));

      lab.appendChild(inp);
      lab.appendChild(caja);
      grupo.appendChild(lab);
    });
    app.appendChild(grupo);

    var pie = el('div', 'cl-pie');
    if (estado.paso > 0) {
      var atras = el('button', 'btn btn-o', 'Atrás');
      atras.type = 'button';
      atras.addEventListener('click', function () { estado.paso--; render(); enfocar(); });
      pie.appendChild(atras);
    }
    var sig = el('button', 'btn btn-p', estado.paso === activos.length - 1 ? 'Ver resultado →' : 'Siguiente →');
    sig.type = 'button';
    sig.id = 'cl-siguiente';
    sig.addEventListener('click', function () {
      var vals = [];
      grupo.querySelectorAll('input:checked').forEach(function (x) { vals.push(x.value); });
      estado.r[p.id] = p.tipo === 'radio' ? vals[0] : vals;
      estado.paso++;
      render();
      enfocar();
      app.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    pie.appendChild(sig);
    app.appendChild(pie);

    function actualizarBoton() {
      var n = grupo.querySelectorAll('input:checked').length;
      sig.disabled = (p.tipo === 'radio' && n === 0);
    }
    actualizarBoton();
  }

  // El portapapeles moderno exige un contexto seguro; si no está disponible
  // (algunos navegadores al abrir el fichero en local), se usa el método clásico.
  function copiarTexto(txt) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt);
    return new Promise(function (ok, ko) {
      var ta = document.createElement('textarea');
      ta.value = txt;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var hecho = false;
      try { hecho = document.execCommand('copy'); } catch (e) { hecho = false; }
      document.body.removeChild(ta);
      if (hecho) { ok(); } else { ko(new Error('copia no disponible')); }
    });
  }

  var NIVELES = {
    prohibido:  { etq: 'Riesgo inaceptable', color: '#991b1b', fondo: '#fee2e2', borde: '#dc2626' },
    alto:       { etq: 'Alto riesgo',        color: '#92400e', fondo: '#fef3c7', borde: '#f59e0b' },
    revisar:    { etq: 'Pendiente de confirmar', color: '#92400e', fondo: '#fef3c7', borde: '#f59e0b' },
    exceptuado: { etq: 'Posible excepción',  color: '#1e40af', fondo: '#dbeafe', borde: '#3b82f6' },
    limitado:   { etq: 'Riesgo limitado',    color: '#065f46', fondo: '#d1fae5', borde: '#10b981' },
    minimo:     { etq: 'Riesgo mínimo',      color: '#334155', fondo: '#f1f5f9', borde: '#94a3b8' }
  };

  function renderResultado() {
    var res = clasificar(estado.r);
    var n = NIVELES[res.nivel];
    app.innerHTML = '';

    var cab = el('div', 'cl-resultado-cab');
    cab.style.background = n.fondo;
    cab.style.borderColor = n.borde;
    var etq = el('span', 'cl-nivel', n.etq);
    etq.style.color = n.color;
    cab.appendChild(etq);
    cab.appendChild(el('h2', null, res.titulo));
    cab.appendChild(el('p', null, res.resumen));
    app.appendChild(cab);

    res.bloques.forEach(function (b) {
      var card = el('div', 'cl-bloque' + (b.urgente ? ' cl-urgente' : ''));
      var cabB = el('div', 'cl-bloque-cab');
      cabB.appendChild(el('h3', null, b.t));
      if (b.fecha) cabB.appendChild(el('span', 'cl-fecha', b.fecha));
      card.appendChild(cabB);
      var ul = el('ul');
      b.items.forEach(function (i) { ul.appendChild(el('li', null, i)); });
      card.appendChild(ul);
      app.appendChild(card);
    });

    var limites = el('div', 'cl-limites');
    limites.appendChild(el('h3', null, 'Hasta dónde llega esta herramienta'));
    var ulL = el('ul');
    [
      'Esto es una orientación, no un dictamen jurídico. La clasificación real depende de la finalidad prevista, del contexto de uso y de detalles que un cuestionario no captura.',
      'Un mismo sistema puede cambiar de categoría al cambiar su uso. La clasificación hay que revisarla, no hacerla una vez.',
      'No he guardado nada. Las respuestas se han procesado en tu navegador y desaparecen al cerrar esta página.',
      'Si el resultado te sale «alto riesgo» o «prohibido», contrástalo con alguien antes de tomar decisiones de negocio.'
    ].forEach(function (t) { ulL.appendChild(el('li', null, t)); });
    limites.appendChild(ulL);
    app.appendChild(limites);

    var acciones = el('div', 'cl-acciones');
    var copiar = el('button', 'btn btn-o', 'Copiar resumen');
    copiar.type = 'button';
    copiar.addEventListener('click', function () {
      var txt = res.titulo + '\n\n' + res.resumen + '\n\n' + res.bloques.map(function (b) {
        return b.t + (b.fecha ? ' (' + b.fecha + ')' : '') + '\n' +
          b.items.map(function (i) { return '  - ' + i; }).join('\n');
      }).join('\n\n') + '\n\nGenerado con el clasificador de riesgo del EU AI Act de FormacionTech (formaciontech.es/clasificador-riesgo-ia)';
      copiarTexto(txt).then(function () {
        copiar.textContent = 'Copiado';
        setTimeout(function () { copiar.textContent = 'Copiar resumen'; }, 2000);
      }).catch(function () { copiar.textContent = 'No se pudo copiar'; });
    });
    var otra = el('button', 'btn btn-o', 'Empezar de nuevo');
    otra.type = 'button';
    otra.addEventListener('click', function () { estado = { paso: 0, r: {} }; render(); enfocar(); });
    var contacto = el('a', 'btn btn-p', 'Revisarlo contigo →');
    contacto.href = 'https://formaciontech.es/contacto/?motivo=diagnostico';

    acciones.appendChild(contacto);
    acciones.appendChild(copiar);
    acciones.appendChild(otra);
    app.appendChild(acciones);

    app.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  render();
})();
