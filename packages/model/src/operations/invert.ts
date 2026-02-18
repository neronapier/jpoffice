import type { JPOperation } from './operation';

/**
 * Invert an operation. The inverse of an operation undoes its effect.
 * This is the basis of the undo system.
 */
export function invertOperation(op: JPOperation): JPOperation {
	switch (op.type) {
		case 'insert_text':
			return {
				type: 'delete_text',
				path: op.path,
				offset: op.offset,
				text: op.text,
			};

		case 'delete_text':
			return {
				type: 'insert_text',
				path: op.path,
				offset: op.offset,
				text: op.text,
			};

		case 'insert_node':
			return {
				type: 'remove_node',
				path: op.path,
				node: op.node,
			};

		case 'remove_node':
			return {
				type: 'insert_node',
				path: op.path,
				node: op.node,
			};

		case 'split_node':
			return {
				type: 'merge_node',
				path: [...op.path.slice(0, -1), op.path[op.path.length - 1] + 1],
				position: op.position,
				properties: op.properties,
			};

		case 'merge_node':
			return {
				type: 'split_node',
				path: [...op.path.slice(0, -1), op.path[op.path.length - 1] - 1],
				position: op.position,
				properties: op.properties,
			};

		case 'move_node':
			return {
				type: 'move_node',
				path: op.newPath,
				newPath: op.path,
			};

		case 'set_properties':
			return {
				type: 'set_properties',
				path: op.path,
				properties: op.oldProperties,
				oldProperties: op.properties,
			};

		case 'set_selection':
			return {
				type: 'set_selection',
				oldSelection: op.newSelection,
				newSelection: op.oldSelection,
			};
	}
}
