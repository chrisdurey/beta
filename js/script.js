document.addEventListener('DOMContentLoaded', () => {
    // --- Global Data Storage & Constants ---
    let carreras = JSON.parse(localStorage.getItem('carreras')) || [];
    let materias = JSON.parse(localStorage.getItem('materias')) || [];
    let maestros = JSON.parse(localStorage.getItem('maestros')) || [];
    // scheduleData ahora es un objeto anidado por carreraId
    // { carreraId: { day_timeIndex: { materiaId, maestroId } } }
    let allScheduleData = JSON.parse(localStorage.getItem('allScheduleData')) || {};

    let activeCarreraId = localStorage.getItem('activeCarreraId') ? parseInt(localStorage.getItem('activeCarreraId')) : null;

    const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const weekTimes = [
        '7:00 AM - 7:50 AM', '7:50 AM - 8:40 AM', '8:40 AM - 9:30 AM',
        '9:30 AM - 10:00 AM (Receso)',
        '10:00 AM - 10:50 AM', '10:50 AM - 11:40 AM', '11:40 AM - 12:30 PM',
        '12:30 PM - 1:20 PM', '1:20 PM - 2:10 PM', '2:10 PM - 3:00 PM'
    ];
    const saturdayTimes = [
        '8:00 AM - 9:00 AM', '9:00 AM - 10:00 AM', '10:00 AM - 11:00 AM',
        '11:00 AM - 12:00 PM', '12:00 PM - 1:00 PM'
    ];

    // --- Helper Functions for List Items (Carrera, Materia, Maestro) ---
    const createListItem = (name, id, type) => {
        const li = document.createElement('li');
        li.setAttribute('data-id', id);
        li.setAttribute('data-type', type);
        li.innerHTML = `
            <span class="editable-item">${name}</span>
            <div class="item-actions">
                <button class="edit-item-btn" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="delete-item-btn" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        li.querySelector('.edit-item-btn').addEventListener('click', () => editItem(id, type));
        li.querySelector('.delete-item-btn').addEventListener('click', () => deleteItem(id, type));
        return li;
    };

    const editItem = (id, type) => {
        const span = document.querySelector(`li[data-id="${id}"][data-type="${type}"] .editable-item`);
        if (!span) return;

        span.contentEditable = true;
        span.classList.add('editing');
        span.focus();

        const originalText = span.textContent;

        const saveChanges = () => {
            span.contentEditable = false;
            span.classList.remove('editing');
            const newName = span.textContent.trim();

            if (newName === "") {
                alert("El nombre no puede estar vacío. Se restaurará el valor anterior.");
                span.textContent = originalText;
                return;
            }

            let dataArray;
            switch (type) {
                case 'carrera': dataArray = carreras; break;
                case 'materia': dataArray = materias; break;
                case 'maestro': dataArray = maestros; break;
            }

            const index = dataArray.findIndex(item => item.id === id);
            if (index !== -1) {
                dataArray[index].nombre = newName;
                localStorage.setItem(`${type}s`, JSON.stringify(dataArray));
                if (type === 'carrera') {
                    renderCarreras();
                    // Si la carrera activa fue editada, actualizar el selector
                    if (activeCarreraId === id) {
                         const activeCarreraOption = document.querySelector(`#selectActiveCarrera option[value="${id}"]`);
                         if(activeCarreraOption) activeCarreraOption.textContent = newName;
                    }
                } else if (type === 'materia') {
                    renderMaterias();
                } else if (type === 'maestro') {
                    renderMaestros();
                }
                generateHorarios(); // Actualizar horario si se editó algo que lo afecta
            }
        };

        span.addEventListener('blur', saveChanges, { once: true });
        span.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveChanges();
            }
        });
    };

    const deleteItem = (id, type) => {
        if (confirm(`¿Estás seguro de que quieres eliminar este ${type}?`)) {
            let dataArray;
            switch (type) {
                case 'carrera':
                    dataArray = carreras;
                    // También elimina los horarios asociados a esta carrera
                    if (allScheduleData[id]) {
                        delete allScheduleData[id];
                        localStorage.setItem('allScheduleData', JSON.stringify(allScheduleData));
                    }
                    if (activeCarreraId === id) { // Si se elimina la carrera activa, resetearla
                        activeCarreraId = null;
                        localStorage.removeItem('activeCarreraId');
                    }
                    break;
                case 'materia':
                    dataArray = materias;
                    // Limpiar asignaciones que usan esta materia
                    for (const cId in allScheduleData) {
                        for (const key in allScheduleData[cId]) {
                            if (allScheduleData[cId][key].materiaId === id) {
                                delete allScheduleData[cId][key];
                            }
                        }
                    }
                    localStorage.setItem('allScheduleData', JSON.stringify(allScheduleData));
                    break;
                case 'maestro':
                    dataArray = maestros;
                    // Limpiar asignaciones que usan este maestro
                    for (const cId in allScheduleData) {
                        for (const key in allScheduleData[cId]) {
                            if (allScheduleData[cId][key].maestroId === id) {
                                delete allScheduleData[cId][key];
                            }
                        }
                    }
                    localStorage.setItem('allScheduleData', JSON.stringify(allScheduleData));
                    break;
            }

            const initialLength = dataArray.length;
            dataArray = dataArray.filter(item => item.id !== id);
            if (dataArray.length < initialLength) { // Solo si se eliminó algo
                localStorage.setItem(`${type}s`, JSON.stringify(dataArray));
                alert(`${type.charAt(0).toUpperCase() + type.slice(1)} eliminado.`);
            }

            if (type === 'carrera') {
                renderCarreras();
                populateCarreraSelector();
            } else if (type === 'materia') {
                renderMaterias();
            } else if (type === 'maestro') {
                renderMaestros();
            }
            generateHorarios(); // Regenerar horario
        }
    };


    // --- 0. Gestión de Carreras ---
    const nombreCarreraInput = document.getElementById('nombreCarrera');
    const agregarCarreraBtn = document.getElementById('agregarCarrera');
    const listaCarrerasUL = document.getElementById('listaCarreras');
    const buscarCarreraInput = document.getElementById('buscarCarrera');
    const limpiarBusquedaCarreraBtn = document.getElementById('limpiarBusquedaCarrera');
    const selectActiveCarrera = document.getElementById('selectActiveCarrera');

    const renderCarreras = (filter = '') => {
        listaCarrerasUL.innerHTML = '';
        const lowerCaseFilter = filter.toLowerCase();
        const filteredCarreras = carreras.filter(carrera =>
            carrera.nombre.toLowerCase().includes(lowerCaseFilter)
        );

        if (filter.length >= 2) {
            filteredCarreras.forEach(carrera => {
                const li = createListItem(carrera.nombre, carrera.id, 'carrera');
                listaCarrerasUL.appendChild(li);
            });
        } else {
            carreras.forEach(carrera => {
                const li = createListItem(carrera.nombre, carrera.id, 'carrera');
                listaCarrerasUL.appendChild(li);
            });
        }
    };

    const addCarrera = () => {
        const nombre = nombreCarreraInput.value.trim();
        if (nombre) {
            const newCarrera = { id: Date.now(), nombre };
            carreras.push(newCarrera);
            localStorage.setItem('carreras', JSON.stringify(carreras));
            renderCarreras();
            populateCarreraSelector();
            nombreCarreraInput.value = '';
            // Si es la primera carrera, la hacemos activa automáticamente
            if (carreras.length === 1) {
                activeCarreraId = newCarrera.id;
                localStorage.setItem('activeCarreraId', activeCarreraId);
                selectActiveCarrera.value = activeCarreraId;
                generateHorarios();
            }
        } else {
            alert('Por favor, ingresa el nombre de la carrera.');
        }
    };

    const populateCarreraSelector = () => {
        selectActiveCarrera.innerHTML = '<option value="">-- Selecciona una Carrera --</option>';
        carreras.forEach(carrera => {
            const option = document.createElement('option');
            option.value = carrera.id;
            option.textContent = carrera.nombre;
            selectActiveCarrera.appendChild(option);
        });

        // Restaurar la selección activa
        if (activeCarreraId && carreras.some(c => c.id === activeCarreraId)) {
            selectActiveCarrera.value = activeCarreraId;
        } else {
            activeCarreraId = null; // Resetear si la carrera activa ya no existe
            localStorage.removeItem('activeCarreraId');
        }
        generateHorarios(); // Regenerar horario para la carrera activa
    };

    agregarCarreraBtn.addEventListener('click', addCarrera);
    buscarCarreraInput.addEventListener('keyup', (e) => {
        if (e.target.value.length >= 2 || e.target.value.length === 0) {
            renderCarreras(e.target.value);
        }
    });
    limpiarBusquedaCarreraBtn.addEventListener('click', () => {
        buscarCarreraInput.value = '';
        renderCarreras();
    });
    selectActiveCarrera.addEventListener('change', (e) => {
        activeCarreraId = e.target.value ? parseInt(e.target.value) : null;
        if (activeCarreraId) {
            localStorage.setItem('activeCarreraId', activeCarreraId);
        } else {
            localStorage.removeItem('activeCarreraId');
        }
        generateHorarios();
    });


    // --- 1. Captura de Materia ---
    const nombreMateriaInput = document.getElementById('nombreMateria');
    const especialidadMateriaInput = document.getElementById('especialidadMateria');
    const agregarMateriaBtn = document.getElementById('agregarMateria');
    const listaMateriasUL = document.getElementById('listaMaterias');
    const buscarMateriaInput = document.getElementById('buscarMateria');
    const limpiarBusquedaMateriaBtn = document.getElementById('limpiarBusquedaMateria');

    const renderMaterias = (filter = '') => {
        listaMateriasUL.innerHTML = '';
        const lowerCaseFilter = filter.toLowerCase();
        const filteredMaterias = materias.filter(materia =>
            materia.nombre.toLowerCase().includes(lowerCaseFilter) ||
            materia.especialidad.toLowerCase().includes(lowerCaseFilter)
        );

        if (filter.length >= 2) {
            filteredMaterias.forEach(materia => {
                const li = createListItem(materia.nombre, materia.id, 'materia');
                listaMateriasUL.appendChild(li);
            });
        } else {
            // Si el filtro es menos de 2 caracteres o vacío, mostrar todas.
            materias.forEach(materia => {
                const li = createListItem(materia.nombre, materia.id, 'materia');
                listaMateriasUL.appendChild(li);
            });
        }
    };

    const addMateria = () => {
        const nombre = nombreMateriaInput.value.trim();
        const especialidad = especialidadMateriaInput.value.trim();
        if (nombre && especialidad) {
            const newMateria = { id: Date.now(), nombre, especialidad };
            materias.push(newMateria);
            localStorage.setItem('materias', JSON.stringify(materias));
            renderMaterias();
            nombreMateriaInput.value = '';
            especialidadMateriaInput.value = '';
            generateHorarios();
        } else {
            alert('Por favor, ingresa el nombre y la especialidad de la materia.');
        }
    };

    agregarMateriaBtn.addEventListener('click', addMateria);
    buscarMateriaInput.addEventListener('keyup', (e) => {
        if (e.target.value.length >= 2 || e.target.value.length === 0) {
            renderMaterias(e.target.value);
        }
    });
    limpiarBusquedaMateriaBtn.addEventListener('click', () => {
        buscarMateriaInput.value = '';
        renderMaterias();
    });

    // --- 2. Captura de Maestro ---
    const nombreMaestroInput = document.getElementById('nombreMaestro');
    const especialidadMaestroInput = document.getElementById('especialidadMaestro');
    const agregarMaestroBtn = document.getElementById('agregarMaestro');
    const listaMaestrosUL = document.getElementById('listaMaestros');
    const buscarMaestroInput = document.getElementById('buscarMaestro');
    const limpiarBusquedaMaestroBtn = document.getElementById('limpiarBusquedaMaestro');

    const renderMaestros = (filter = '') => {
        listaMaestrosUL.innerHTML = '';
        const lowerCaseFilter = filter.toLowerCase();
        const filteredMaestros = maestros.filter(maestro =>
            maestro.nombre.toLowerCase().includes(lowerCaseFilter) ||
            maestro.especialidad.toLowerCase().includes(lowerCaseFilter)
        );

        if (filter.length >= 2) {
            filteredMaestros.forEach(maestro => {
                const li = createListItem(maestro.nombre, maestro.id, 'maestro');
                listaMaestrosUL.appendChild(li);
            });
        } else {
            maestros.forEach(maestro => {
                const li = createListItem(maestro.nombre, maestro.id, 'maestro');
                listaMaestrosUL.appendChild(li);
            });
        }
    };

    const addMaestro = () => {
        const nombre = nombreMaestroInput.value.trim();
        const especialidad = especialidadMaestroInput.value.trim();
        if (nombre && especialidad) {
            const newMaestro = { id: Date.now(), nombre, especialidad };
            maestros.push(newMaestro);
            localStorage.setItem('maestros', JSON.stringify(maestros));
            renderMaestros();
            nombreMaestroInput.value = '';
            especialidadMaestroInput.value = '';
            generateHorarios();
        } else {
            alert('Por favor, ingresa el nombre y la especialidad del maestro.');
        }
    };

    agregarMaestroBtn.addEventListener('click', addMaestro);
    buscarMaestroInput.addEventListener('keyup', (e) => {
        if (e.target.value.length >= 2 || e.target.value.length === 0) {
            renderMaestros(e.target.value);
        }
    });
    limpiarBusquedaMaestroBtn.addEventListener('click', () => {
        buscarMaestroInput.value = '';
        renderMaestros();
    });

    // --- Horarios y Mostrar Horario Generado ---
    const horarioSemanalDiv = document.querySelector('#horario-semanal .schedule-grid');
    const horarioSabadoDiv = document.querySelector('#horario-sabado .schedule-grid');
    const horarioCompletoOutput = document.getElementById('horarioCompleto');
    const scheduleSections = document.getElementById('schedule-sections'); // Contenedor de los horarios

    const generateHorarios = () => {
        if (!activeCarreraId) {
            horarioSemanalDiv.innerHTML = '<p class="info-text">Selecciona una carrera para gestionar su horario.</p>';
            horarioSabadoDiv.innerHTML = '<p class="info-text">Selecciona una carrera para gestionar su horario.</p>';
            horarioCompletoOutput.textContent = 'Selecciona una carrera para ver su horario completo.';
            scheduleSections.style.display = 'none'; // Ocultar secciones de horario
            return;
        } else {
            scheduleSections.style.display = 'block'; // Mostrar secciones de horario
        }

        const currentScheduleData = allScheduleData[activeCarreraId] || {};

        // Limpiar asignaciones si la materia o maestro ya no existen
        for (const key in currentScheduleData) {
            const assignment = currentScheduleData[key];
            const materiaExists = materias.some(m => m.id === assignment.materiaId);
            const maestroExists = maestros.some(m => m.id === assignment.maestroId);
            if (!materiaExists || !maestroExists) {
                delete currentScheduleData[key];
            }
        }
        allScheduleData[activeCarreraId] = currentScheduleData;
        localStorage.setItem('allScheduleData', JSON.stringify(allScheduleData));

        // Horario Semanal (L-V)
        horarioSemanalDiv.innerHTML = '';
        const headerDaysWeek = ['Hora', ...daysOfWeek];

        headerDaysWeek.forEach(day => {
            const headerCell = document.createElement('div');
            headerCell.classList.add('header-cell');
            headerCell.textContent = day;
            horarioSemanalDiv.appendChild(headerCell);
        });

        weekTimes.forEach((time, timeIndex) => {
            const timeCell = document.createElement('div');
            timeCell.classList.add('time-cell');
            if (time.includes('Receso')) {
                timeCell.classList.add('break-cell');
            }
            timeCell.textContent = time;
            horarioSemanalDiv.appendChild(timeCell);

            if (time.includes('Receso')) {
                for (let i = 0; i < 5; i++) {
                    const breakFiller = document.createElement('div');
                    breakFiller.classList.add('break-cell');
                    horarioSemanalDiv.appendChild(breakFiller);
                }
            } else {
                daysOfWeek.forEach(day => {
                    const cell = document.createElement('div');
                    cell.classList.add('schedule-cell');
                    cell.setAttribute('data-day', day.toLowerCase());
                    cell.setAttribute('data-time-index', timeIndex);

                    const key = `${day.toLowerCase()}_${timeIndex}`;
                    if (currentScheduleData[key]) {
                        const materia = materias.find(m => m.id === currentScheduleData[key].materiaId);
                        const maestro = maestros.find(m => m.id === currentScheduleData[key].maestroId);
                        if (materia && maestro) {
                            cell.classList.add('assigned');
                            cell.innerHTML = `
                                <strong>${materia.nombre}</strong><br>
                                <small>${maestro.nombre}</small>
                            `;
                        }
                    }

                    cell.addEventListener('click', () => openAssignModal(day.toLowerCase(), timeIndex, cell));
                    horarioSemanalDiv.appendChild(cell);
                });
            }
        });

        // Horario Sábado
        horarioSabadoDiv.innerHTML = '';
        horarioSabadoDiv.style.gridTemplateColumns = 'repeat(2, 1fr)';

        const satHeader = document.createElement('div');
        satHeader.classList.add('header-cell');
        satHeader.textContent = 'Hora';
        horarioSabadoDiv.appendChild(satHeader);

        const satDayHeader = document.createElement('div');
        satDayHeader.classList.add('header-cell');
        satDayHeader.textContent = 'Sábado';
        horarioSabadoDiv.appendChild(satDayHeader);

        saturdayTimes.forEach((time, timeIndex) => {
            const timeCell = document.createElement('div');
            timeCell.classList.add('time-cell');
            timeCell.textContent = time;
            horarioSabadoDiv.appendChild(timeCell);

            const cell = document.createElement('div');
            cell.classList.add('schedule-cell');
            cell.setAttribute('data-day', 'sabado');
            cell.setAttribute('data-time-index', timeIndex);

            const key = `sabado_${timeIndex}`;
            if (currentScheduleData[key]) {
                const materia = materias.find(m => m.id === currentScheduleData[key].materiaId);
                const maestro = maestros.find(m => m.id === currentScheduleData[key].maestroId);
                if (materia && maestro) {
                    cell.classList.add('assigned');
                    cell.innerHTML = `
                        <strong>${materia.nombre}</strong><br>
                        <small>${maestro.nombre}</small>
                    `;
                }
            }
            cell.addEventListener('click', () => openAssignModal('sabado', timeIndex, cell));
            horarioSabadoDiv.appendChild(cell);
        });

        // Mostrar horario completo en texto
        displayFullSchedule();
    };

    const displayFullSchedule = () => {
        const currentScheduleData = allScheduleData[activeCarreraId] || {};
        const activeCarrera = carreras.find(c => c.id === activeCarreraId);
        const carreraName = activeCarrera ? activeCarrera.nombre : 'Sin Carrera Seleccionada';

        let fullScheduleText = `--- Horario para: ${carreraName} ---\n\n`;
        fullScheduleText += '--- Horario Semanal (Lunes a Viernes) ---\n\n';

        fullScheduleText += 'Hora                          | Lunes                         | Martes                        | Miércoles                     | Jueves                        | Viernes\n';
        fullScheduleText += '------------------------------|-------------------------------|-------------------------------|-------------------------------|-------------------------------|-------------------------------\n';


        weekTimes.forEach((time, timeIndex) => {
            fullScheduleText += `${time.padEnd(29)} | `;
            daysOfWeek.forEach(day => {
                const key = `${day.toLowerCase()}_${timeIndex}`;
                if (currentScheduleData[key]) {
                    const materia = materias.find(m => m.id === currentScheduleData[key].materiaId);
                    const maestro = maestros.find(m => m.id === currentScheduleData[key].maestroId);
                    if (materia && maestro) {
                        let content = `${materia.nombre} (${maestro.nombre})`;
                        fullScheduleText += `${content.padEnd(30)} | `;
                    } else {
                        fullScheduleText += 'Vacío'.padEnd(30) + ' | ';
                    }
                } else if (time.includes('Receso')) {
                    fullScheduleText += 'RECESO'.padEnd(30) + ' | ';
                } else {
                    fullScheduleText += 'Vacío'.padEnd(30) + ' | ';
                }
            });
            fullScheduleText += '\n';
        });

        fullScheduleText += '\n\n--- Horario Sábado ---\n\n';
        fullScheduleText += 'Hora                          | Sábado\n';
        fullScheduleText += '------------------------------|-------------------------------\n';


        saturdayTimes.forEach((time, timeIndex) => {
            fullScheduleText += `${time.padEnd(29)} | `;
            const key = `sabado_${timeIndex}`;
            if (currentScheduleData[key]) {
                const materia = materias.find(m => m.id === currentScheduleData[key].materiaId);
                const maestro = maestros.find(m => m.id === currentScheduleData[key].maestroId);
                if (materia && maestro) {
                    let content = `${materia.nombre} (${maestro.nombre})`;
                    fullScheduleText += `${content.padEnd(30)}`;
                } else {
                    fullScheduleText += 'Vacío'.padEnd(30);
                }
            } else {
                fullScheduleText += 'Vacío'.padEnd(30);
            }
            fullScheduleText += '\n';
        });

        horarioCompletoOutput.textContent = fullScheduleText;
    };


    // Modal para asignar materia y maestro
    const assignModal = document.getElementById('assignModal');
    const closeModalBtn = assignModal.querySelector('.close-button');
    const assignBtn = assignModal.querySelector('#assignBtn');
    const unassignBtn = assignModal.querySelector('#unassignBtn');
    const cancelBtn = assignModal.querySelector('#cancelBtn');
    const modalDaySpan = assignModal.querySelector('#modalDay');
    const modalTimeSpan = assignModal.querySelector('#modalTime');
    const selectMateria = assignModal.querySelector('#selectMateria');
    const selectMaestro = assignModal.querySelector('#selectMaestro');

    let currentCellData = {};

    const openAssignModal = (day, timeIndex, cellElement) => {
        if (!activeCarreraId) {
            alert('Por favor, selecciona una carrera primero.');
            return;
        }

        currentCellData = { day, timeIndex, cellElement };

        modalDaySpan.textContent = day.charAt(0).toUpperCase() + day.slice(1);
        let displayTime = (day === 'sabado') ? saturdayTimes[timeIndex] : weekTimes[timeIndex];
        modalTimeSpan.textContent = displayTime;

        selectMateria.innerHTML = '<option value="">-- Selecciona Materia --</option>';
        materias.forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = `${m.nombre} (${m.especialidad})`;
            selectMateria.appendChild(option);
        });

        selectMaestro.innerHTML = '<option value="">-- Selecciona Maestro --</option>';
        maestros.forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = `${m.nombre} (${m.especialidad})`;
            selectMaestro.appendChild(option);
        });

        const currentScheduleData = allScheduleData[activeCarreraId] || {};
        const key = `${day}_${timeIndex}`;
        if (currentScheduleData[key]) {
            selectMateria.value = currentScheduleData[key].materiaId;
            selectMaestro.value = currentScheduleData[key].maestroId;
            unassignBtn.style.display = 'inline-block';
        } else {
            selectMateria.value = '';
            selectMaestro.value = '';
            unassignBtn.style.display = 'none';
        }

        assignModal.style.display = 'flex';
    };

    const closeAssignModal = () => {
        assignModal.style.display = 'none';
    };

    closeModalBtn.addEventListener('click', closeAssignModal);
    cancelBtn.addEventListener('click', closeAssignModal);
    window.addEventListener('click', (event) => {
        if (event.target === assignModal) {
            closeAssignModal();
        }
    });

    assignBtn.addEventListener('click', () => {
        const { day, timeIndex, cellElement } = currentCellData;
        const materiaId = parseInt(selectMateria.value);
        const maestroId = parseInt(selectMaestro.value);

        if (!materiaId || !maestroId) {
            alert('Por favor, selecciona una materia y un maestro.');
            return;
        }

        const materia = materias.find(m => m.id === materiaId);
        const maestro = maestros.find(m => m.id === maestroId);

        if (materia && maestro) {
            if (!allScheduleData[activeCarreraId]) {
                allScheduleData[activeCarreraId] = {};
            }
            const key = `${day}_${timeIndex}`;
            allScheduleData[activeCarreraId][key] = { materiaId, maestroId };
            localStorage.setItem('allScheduleData', JSON.stringify(allScheduleData));
            generateHorarios();
            closeAssignModal();
        } else {
            alert('Error: Materia o maestro no encontrados. Intenta de nuevo.');
        }
    });

    unassignBtn.addEventListener('click', () => {
        const { day, timeIndex } = currentCellData;
        const key = `${day}_${timeIndex}`;
        if (confirm('¿Estás seguro de que quieres desasignar esta clase?')) {
            if (allScheduleData[activeCarreraId] && allScheduleData[activeCarreraId][key]) {
                delete allScheduleData[activeCarreraId][key];
                localStorage.setItem('allScheduleData', JSON.stringify(allScheduleData));
                generateHorarios();
            }
            closeAssignModal();
        }
    });


    // --- 6. Botones de Exportar (Mejorados) ---
    const exportPdfBtn = document.getElementById('exportPdf');
    const exportExcelBtn = document.getElementById('exportExcel');
    const printScheduleBtn = document.getElementById('printSchedule');

    exportPdfBtn.addEventListener('click', () => {
        if (!activeCarreraId) {
            alert('Por favor, selecciona una carrera para exportar su horario.');
            return;
        }

        const activeCarrera = carreras.find(c => c.id === activeCarreraId);
        const carreraName = activeCarrera ? activeCarrera.nombre : 'Horario';
        const currentScheduleData = allScheduleData[activeCarreraId] || {};

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Título del documento
        doc.setFontSize(18);
        doc.text(`Horario Generado: ${carreraName}`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Fecha de Exportación: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 28);


        // Preparar datos para la tabla semanal
        const weeklyHeaders = [['Hora', ...daysOfWeek]];
        const weeklyData = weekTimes.map((time, timeIndex) => {
            const row = [time];
            daysOfWeek.forEach(day => {
                const key = `${day.toLowerCase()}_${timeIndex}`;
                if (currentScheduleData[key]) {
                    const materia = materias.find(m => m.id === currentScheduleData[key].materiaId);
                    const maestro = maestros.find(m => m.id === currentScheduleData[key].maestroId);
                    row.push(materia && maestro ? `${materia.nombre}\n(${maestro.nombre})` : 'Vacío');
                } else if (time.includes('Receso')) {
                    row.push('RECESO');
                } else {
                    row.push('Vacío');
                }
            });
            return row;
        });

        // Añadir tabla semanal al PDF
        doc.autoTable({
            startY: 40,
            head: weeklyHeaders,
            body: weeklyData,
            theme: 'grid', // 'striped', 'grid', 'plain'
            headStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold' }, // dark-bg
            alternateRowStyles: { fillColor: [249, 249, 249] }, // light grey
            styles: {
                font: 'helvetica',
                fontSize: 8,
                cellPadding: 3,
                valign: 'middle',
                overflow: 'linebreak', // Permitir saltos de línea dentro de las celdas
            },
            columnStyles: { 0: { fontStyle: 'bold', fillColor: [74, 144, 226], textColor: 255 } }, // primary-color for time column
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index !== 0 && data.cell.text[0] === 'RECESO') {
                    data.cell.styles.fillColor = [245, 166, 35]; // accent-color for Receso
                    data.cell.styles.textColor = 255;
                    data.cell.styles.fontStyle = 'bold';
                } else if (data.section === 'body' && data.column.index !== 0 && data.cell.text[0].includes('(')) {
                     data.cell.styles.fillColor = [80, 227, 194]; // secondary-color for assigned cells
                     data.cell.styles.textColor = [44, 62, 80];
                }
            }
        });

        // Separador y título para la tabla de Sábado
        doc.addPage();
        doc.setFontSize(18);
        doc.text(`Horario Sábado: ${carreraName}`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Fecha de Exportación: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 28);


        // Preparar datos para la tabla de Sábado
        const saturdayHeaders = [['Hora', 'Sábado']];
        const saturdayData = saturdayTimes.map((time, timeIndex) => {
            const row = [time];
            const key = `sabado_${timeIndex}`;
            if (currentScheduleData[key]) {
                const materia = materias.find(m => m.id === currentScheduleData[key].materiaId);
                const maestro = maestros.find(m => m.id === currentScheduleData[key].maestroId);
                row.push(materia && maestro ? `${materia.nombre}\n(${maestro.nombre})` : 'Vacío');
            } else {
                row.push('Vacío');
            }
            return row;
        });

        // Añadir tabla de Sábado al PDF
        doc.autoTable({
            startY: 40,
            head: saturdayHeaders,
            body: saturdayData,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [249, 249, 249] },
            styles: {
                font: 'helvetica',
                fontSize: 8,
                cellPadding: 3,
                valign: 'middle',
                overflow: 'linebreak',
            },
            columnStyles: { 0: { fontStyle: 'bold', fillColor: [74, 144, 226], textColor: 255 } },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index !== 0 && data.cell.text[0].includes('(')) {
                     data.cell.styles.fillColor = [80, 227, 194];
                     data.cell.styles.textColor = [44, 62, 80];
                }
            }
        });

        doc.save(`horario_${carreraName.replace(/\s+/g, '_').toLowerCase()}.pdf`);
        alert('Horario exportado a PDF.');
    });

    exportExcelBtn.addEventListener('click', () => {
        if (!activeCarreraId) {
            alert('Por favor, selecciona una carrera para exportar su horario.');
            return;
        }

        const activeCarrera = carreras.find(c => c.id === activeCarreraId);
        const carreraName = activeCarrera ? activeCarrera.nombre : 'Horario';
        const currentScheduleData = allScheduleData[activeCarreraId] || {};

        const workbook = XLSX.utils.book_new();

        // Hoja Semanal
        const weeklyData = [
            [`Horario Generado para: ${carreraName}`],
            [`Fecha de Exportación: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`],
            [], // Espacio
            ["HORARIO SEMANAL (Lunes a Viernes)"],
            ["Hora", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
        ];

        weekTimes.forEach((time, timeIndex) => {
            const row = [time];
            daysOfWeek.forEach(day => {
                const key = `${day.toLowerCase()}_${timeIndex}`;
                if (currentScheduleData[key]) {
                    const materia = materias.find(m => m.id === currentScheduleData[key].materiaId);
                    const maestro = maestros.find(m => m.id === currentScheduleData[key].maestroId);
                    row.push(materia && maestro ? `${materia.nombre} (${maestro.nombre})` : 'Vacío');
                } else if (time.includes('Receso')) {
                    row.push('RECESO');
                } else {
                    row.push('Vacío');
                }
            });
            weeklyData.push(row);
        });
        const wsWeekly = XLSX.utils.aoa_to_sheet(weeklyData);
        XLSX.utils.book_append_sheet(workbook, wsWeekly, "Horario Semanal");

        // Hoja Sábado
        const saturdayData = [
            [`Horario Generado para: ${carreraName}`],
            [`Fecha de Exportación: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`],
            [], // Espacio
            ["HORARIO SÁBADO"],
            ["Hora", "Sábado"]
        ];

        saturdayTimes.forEach((time, timeIndex) => {
            const row = [time];
            const key = `sabado_${timeIndex}`;
            if (currentScheduleData[key]) {
                const materia = materias.find(m => m.id === currentScheduleData[key].materiaId);
                const maestro = maestros.find(m => m.id === currentScheduleData[key].maestroId);
                row.push(materia && maestro ? `${materia.nombre} (${maestro.nombre})` : 'Vacío');
            } else {
                row.push('Vacío');
            }
            saturdayData.push(row);
        });
        const wsSaturday = XLSX.utils.aoa_to_sheet(saturdayData);
        XLSX.utils.book_append_sheet(workbook, wsSaturday, "Horario Sabado");

        XLSX.writeFile(workbook, `horario_${carreraName.replace(/\s+/g, '_').toLowerCase()}.xlsx`);
        alert('Horario exportado a Excel.');
    });


    printScheduleBtn.addEventListener('click', () => {
        if (!activeCarreraId) {
            alert('Por favor, selecciona una carrera para imprimir su horario.');
            return;
        }
        const printContent = document.getElementById('mostrar-horario').outerHTML; // Captura la sección completa
        const originalContent = document.body.innerHTML;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Imprimir Horario</title>
                    <link rel="stylesheet" href="css/style.css">
                    <style>
                        /* Estilos específicos para impresión */
                        body { margin: 20mm; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                        .header, .footer, .card:not(#mostrar-horario), .input-group, .search-group, .item-actions, .button-group, .modal, .select-carrera-group {
                            display: none !important; /* Oculta elementos no necesarios */
                        }
                        #mostrar-horario {
                            display: block !important;
                            margin: 0;
                            padding: 0;
                            box-shadow: none;
                            border: none;
                        }
                        #horarioCompleto {
                            white-space: pre-wrap;
                            font-family: 'Courier New', Courier, monospace;
                            font-size: 9pt;
                            line-height: 1.5;
                        }
                    </style>
                </head>
                <body>
                    ${printContent}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    });


    // --- 7. Botones de Eliminar y Reiniciar ---
    const eliminarParcialmenteBtn = document.getElementById('eliminarParcialmente');
    const reiniciarTodoBtn = document.getElementById('reiniciarTodo');

    eliminarParcialmenteBtn.addEventListener('click', () => {
        // Decide qué eliminar según la prioridad o el último agregado.
        // Podríamos hacer un modal para elegir o simplemente seguir la lógica:
        // 1. Última carrera (con confirmación especial)
        // 2. Última materia
        // 3. Último maestro
        if (carreras.length > 0) {
            if (confirm('¿Deseas eliminar la ÚLTIMA CARRERA agregada? Esto también borrará sus horarios asociados.')) {
                const lastCarrera = carreras.pop();
                localStorage.setItem('carreras', JSON.stringify(carreras));
                if (allScheduleData[lastCarrera.id]) {
                    delete allScheduleData[lastCarrera.id];
                    localStorage.setItem('allScheduleData', JSON.stringify(allScheduleData));
                }
                if (activeCarreraId === lastCarrera.id) {
                    activeCarreraId = null;
                    localStorage.removeItem('activeCarreraId');
                }
                alert(`Carrera "${lastCarrera.nombre}" eliminada.`);
                renderCarreras();
                populateCarreraSelector();
                generateHorarios();
                return;
            }
        }

        if (maestros.length > 0) {
            if (confirm('¿Deseas eliminar el ÚLTIMO MAESTRO agregado?')) {
                const lastMaestro = maestros.pop();
                localStorage.setItem('maestros', JSON.stringify(maestros));
                // Las asignaciones que usaban este maestro se limpiarán en generateHorarios
                alert(`Maestro "${lastMaestro.nombre}" eliminado.`);
                renderMaestros();
                generateHorarios();
                return;
            }
        }

        if (materias.length > 0) {
            if (confirm('¿Deseas eliminar la ÚLTIMA MATERIA agregada?')) {
                const lastMateria = materias.pop();
                localStorage.setItem('materias', JSON.stringify(materias));
                // Las asignaciones que usaban esta materia se limpiarán en generateHorarios
                alert(`Materia "${lastMateria.nombre}" eliminada.`);
                renderMaterias();
                generateHorarios();
                return;
            }
        }

        alert('No hay elementos (carreras, materias o maestros) para eliminar.');
    });

    reiniciarTodoBtn.addEventListener('click', () => {
        if (confirm('¡ATENCIÓN! Esto eliminará TODOS los datos (carreras, materias, maestros y horarios) y reiniciará la aplicación. ¿Estás seguro?')) {
            localStorage.clear(); // Borra todo del almacenamiento local
            carreras = [];
            materias = [];
            maestros = [];
            allScheduleData = {};
            activeCarreraId = null;
            renderCarreras();
            renderMaterias();
            renderMaestros();
            populateCarreraSelector(); // Reiniciar selector de carrera
            generateHorarios();
            alert('La aplicación ha sido reiniciada. Todos los datos han sido eliminados.');
        }
    });

    // --- Inicialización al cargar la página ---
    renderCarreras();
    renderMaterias();
    renderMaestros();
    populateCarreraSelector();
    generateHorarios(); // Genera y muestra el horario inicial para la carrera activa (o mensaje si no hay)
});