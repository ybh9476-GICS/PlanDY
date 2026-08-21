// Canonical card block model. Compatibility conversion is read-only until a card is explicitly saved.
(function () {
    const textFormatVersion = 2;
    const definitions = new Map();
    const aliases = new Map();

    function registerBlockType(definition) {
        if (!definition || typeof definition.type !== 'string' || !definition.type) {
            throw new TypeError('A card block type requires a non-empty type.');
        }
        const normalized = Object.freeze({ editable: true, aliases: [], ...definition });
        definitions.set(normalized.type, normalized);
        aliases.set(normalized.type, normalized.type);
        normalized.aliases.forEach((alias) => aliases.set(alias, normalized.type));
        return normalized;
    }

    registerBlockType({
        type: 'text',
        label: 'Text',
        aliases: ['plainText', 'text2'],
        canEdit: (block) => !Number(block.formatVersion) || Number(block.formatVersion) <= textFormatVersion,
        normalize: (block) => ({
            ...block,
            type: 'text',
            formatVersion: Math.max(textFormatVersion, Number(block.formatVersion) || 0),
            text: String(block.text || ''),
            html: typeof block.html === 'string' ? block.html : ''
        })
    });
    registerBlockType({ type: 'table', label: 'Table' });
    registerBlockType({ type: 'image', label: 'Image' });
    registerBlockType({ type: 'pdf', label: 'PDF' });
    registerBlockType({ type: 'googleDrive', label: 'Google Drive' });
    registerBlockType({ type: 'diagram', label: 'Diagram', editable: false });

    function getBlockType(type) {
        return definitions.get(aliases.get(type)) || null;
    }

    function normalizeBlock(block) {
        if (!block || typeof block !== 'object') return null;
        const definition = getBlockType(block.type);
        if (!definition) return { ...block };
        if (typeof definition.normalize === 'function') return definition.normalize(block);
        return { ...block, type: definition.type };
    }

    function normalizeBlocks(blocks) {
        return Array.isArray(blocks) ? blocks.map(normalizeBlock).filter(Boolean) : [];
    }

    function createTextBlock(values = {}) {
        return normalizeBlock({ type: 'text', text: '', html: '', ...values });
    }

    function normalizeEditorType(type) {
        return type === 'table' ? 'table' : 'text';
    }

    function isEditableBlock(block) {
        const definition = getBlockType(block?.type);
        return Boolean(definition?.editable && (!definition.canEdit || definition.canEdit(block)));
    }

    window.wmsCardContentModel = Object.freeze({
        textFormatVersion,
        registerBlockType,
        getBlockType,
        normalizeBlock,
        normalizeBlocks,
        createTextBlock,
        normalizeEditorType,
        isEditableBlock
    });
})();
