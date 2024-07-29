const transformOrder = [
    'ALR', 'ILR', 'ExpandedSoftmax', 'NormalizedExponential',
    'StanStickbreaking', 'StickbreakingLogistic', 'StickbreakingNormal',
    'StickbreakingPowerLogistic', 'StickbreakingPowerNormal',
    'StickbreakingAngular'
];

function plotSummary(data, document) {
    const selectedColumn = document.getElementById('columnSelect').value;
    const logScale = document.getElementById('logScaleSelect').checked;
    const selectedEstimate = document.getElementById('estimateSelect').value;

    // Filter data based on the log_scale and estimate selections and remove rows where the selected column is empty
    const filteredData = data.filter(row => row[selectedColumn] !== '' && (row.log_scale === 'True') === logScale && row.estimate === selectedEstimate);

    // Get unique target_config and target values for subplots
    const uniqueConfigs = [...new Set(filteredData.map(row => `${row.target} ${row.target_config}`))];

    // Determine number of rows based on screen width
    const isMobile = window.innerWidth <= 768;
    const isNarrow = window.innerWidth <= 1200;
    const cols = isMobile ? 1 : isNarrow ? 2 : 3;  // Adjust number of columns
    const rows = Math.ceil(uniqueConfigs.length / cols);

    const fig = {
        data: [],
        layout: {
            grid: { rows: rows, columns: cols, pattern: 'independent', roworder: 'top to bottom' },
            title: `${selectedColumn} vs transform`,
            showlegend: false, // Disable legend in the plot
            height: rows * 300,  // Adjust height to make subplots taller
            margin: { l: 80, r: 20, b: 60, t: 50 },  // Adjust margins to ensure titles are visible
            shapes: []
        }
    };

    // Define colors for transforms
    const colors = d3.scaleOrdinal(d3.schemeCategory10).domain(transformOrder);

    // Add traces and lines for each subplot
    const legendTraces = [];
    uniqueConfigs.forEach((config, index) => {
        const [target, targetConfig] = config.split(' ');
        const row = Math.floor(index / cols) + 1;
        const col = (index % cols) + 1;

        const configData = filteredData.filter(row => row.target === target && row.target_config === targetConfig);

        transformOrder.forEach(transform => {
            const transformData = configData.filter(row => row.transform === transform);

            const trace = {
                x: transformData.map(row => row.transform),
                y: transformData.map(row => Number(row[selectedColumn])),
                type: (selectedColumn === 'min_rel_ess_bulk' || selectedColumn === 'max_rhat') ? 'scatter' : 'box',
                mode: 'markers',  // For scatter plot
                name: transform,
                legendgroup: transform,
                marker: { color: colors(transform) },
                xaxis: `x${index + 1}`,
                yaxis: `y${index + 1}`
            };

            fig.data.push(trace);

            if (!legendTraces.some(t => t.name === transform)) {
                legendTraces.push({
                    name: transform,
                    marker: { color: colors(transform) },
                    type: 'scatter',
                    mode: 'markers',
                    x: [null],
                    y: [null]
                });
            }
        });

        fig.layout[`xaxis${index + 1}`] = { title: 'transform', showticklabels: row === rows, visible: row === rows, automargin: true, tickangle: 45 };
        fig.layout[`yaxis${index + 1}`] = { title: selectedColumn, type: selectedColumn !== 'n_divergent' && selectedColumn !== 'bfmi' ? 'log' : 'linear', automargin: true, tickpadding: 10 };
        fig.layout[`annotations`] = fig.layout[`annotations`] || [];
        fig.layout[`annotations`].push({
            text: `<b>${config}</b>`,
            x: 0.5,
            y: 1,
            xref: `x${index + 1} domain`,
            yref: `y${index + 1} domain`,
            showarrow: false,
            xanchor: 'center',
            yanchor: 'bottom'
        });

        // Add horizontal lines for specific columns
        if (selectedColumn === 'bfmi') {
            fig.layout.shapes.push({
                type: 'line',
                x0: 0,
                x1: 1,
                y0: 0.3,
                y1: 0.3,
                xref: `x${index + 1} domain`,
                yref: `y${index + 1}`,
                line: {
                    dash: 'dot',
                    color: 'black'
                }
            });
        } else if (selectedColumn === 'max_rhat') {
            fig.layout.shapes.push({
                type: 'line',
                x0: 0,
                x1: 1,
                y0: 1.01,
                y1: 1.01,
                xref: `x${index + 1} domain`,
                yref: `y${index + 1}`,
                line: {
                    dash: 'dot',
                    color: 'black'
                }
            });
        }
    });

    Plotly.newPlot('plot', fig.data, fig.layout).then(() => {
        const legendDiv = document.getElementById('legendContent');
        legendDiv.innerHTML = ''; // Clear previous legend items

        legendTraces.forEach((trace, index) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.style.color = trace.marker.color;
            legendItem.innerHTML = trace.name;
            legendItem.onclick = () => {
                const traceIndices = fig.data
                    .map((d, i) => (d.name === trace.name ? i : null))
                    .filter(i => i !== null);
                const currentVisibility = fig.data[traceIndices[0]].visible !== 'legendonly';
                Plotly.restyle('plot', { visible: currentVisibility ? 'legendonly' : true }, traceIndices);
                legendItem.classList.toggle('deselected', currentVisibility);
            };
            legendDiv.appendChild(legendItem);
        });
    });
}