/**
 * CSV Parser & Generator
 * Handles parsing CSV from clipboard and generating CSV for export
 */

/**
 * Parse CSV text into objects
 * Automatically detects delimiter (semicolon, comma, or tab)
 * @param text Raw CSV text
 * @returns Array of objects with keys from first row
 */
export const parseCSV = (text: string): Record<string, any>[] => {
    if (!text) return [];
    
    const firstLine = text.split('\n')[0];
    let delimiter = ';';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(',') && !firstLine.includes(';')) delimiter = ',';

    const result: string[][] = [];
    let row: string[] = [];
    let current = "";
    let inQuotes = false;
    
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];
        
        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                current += '"';
                i++; 
            } else if (char === '"') {
                inQuotes = false;
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === delimiter) {
                row.push(current);
                current = "";
            } else if (char === '\n') {
                row.push(current);
                if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
                     result.push(row);
                }
                row = [];
                current = "";
            } else {
                current += char;
            }
        }
    }
    
    if (current || row.length > 0) {
        row.push(current);
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) result.push(row);
    }

    if (result.length === 0) return [];
    
    const headers = result[0].map(h => h.trim().replace(/^"|"$/g, ''));
    
    return result.slice(1).map(values => {
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => {
            let val = values[i] || '';
            obj[h] = val.trim();
        });
        return obj;
    });
};

interface BacklogTask {
    title: string;
    status?: string;
    desc?: string;
    acceptance?: string;
    notes?: string;
    dataFields?: string;
    release?: string;
    tag?: string;
    priority?: string;
    id: string;
    order?: number;
}

/**
 * Generate CSV from backlog tasks
 * @param tasks Array of backlog task objects
 * @param forSheets If true, uses tab delimiter for Google Sheets compatibility
 * @returns CSV format string
 */
export const generateCSV = (tasks: BacklogTask[], forSheets = false): string => {
    const headers = ['Titel', 'Status', 'Beskrivelse', 'Acceptkriterier', 'Noter', 'Datafelter', 'Release', 'Tag', 'Prioritet', 'ID', 'Order'];
    const separator = forSheets ? '\t' : ';'; 
    const csvRows: string[] = [headers.join(separator)];

    tasks.forEach(task => {
        const fields = [
            task.title,
            task.status || 'backlog',
            task.desc,
            task.acceptance,
            task.notes,
            task.dataFields,
            task.release,
            task.tag || 'APP',
            task.priority || 'Medium',
            task.id,
            task.order || 0
        ];

        const row = fields.map(field => {
            let val = String(field || '');
            
            if (forSheets) {
                val = val.replace(/\r\n|\r|\n/g, ' ¶ '); 
                if (val.includes(separator)) {
                     val = val.replace(/"/g, '""');
                     return `"${val}"`;
                }
                return val;
            } else {
                val = val.replace(/"/g, '""');
                return `"${val}"`;
            }
        });

        csvRows.push(row.join(separator));
    });

    return (forSheets ? '' : '\uFEFF') + csvRows.join('\n');
};

interface FeedbackItem {
    userName: string;
    context: string;
    text: string;
    device: string;
    status?: string;
    timestamp: string;
    id: string;
}

/**
 * Generate CSV from feedback items
 * @param feedbackItems Array of feedback objects
 * @returns CSV format string
 */
export const generateFeedbackCSV = (feedbackItems: FeedbackItem[]): string => {
    const headers = ['Bruger', 'Kontekst', 'Tekst', 'Device', 'Status', 'Dato', 'ID'];
    const separator = ';';
    const csvRows: string[] = [headers.join(separator)];

    feedbackItems.forEach(item => {
        const fields = [
            item.userName,
            item.context,
            item.text,
            item.device,
            item.status || 'new',
            item.timestamp,
            item.id
        ];

        const row = fields.map(field => {
            let val = String(field || '').replace(/"/g, '""');
            return `"${val}"`;
        });
        csvRows.push(row.join(separator));
    });
    
    return '\uFEFF' + csvRows.join('\n');
};
