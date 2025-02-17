import { localize } from '@deriv-com/translations';
import { config } from '../../../../constants/config';
import { initErrorHandlingListener, removeErrorHandlingEventListener } from '../../../../utils';
import DBotStore from '../../../dbot-store';
import {
    appendCollapsedMainBlocksFields,
    excludeOptionFromContextMenu,
    modifyContextMenu,
    runIrreversibleEvents,
} from '../../../utils';
import { defineContract } from '../../images';

window.Blockly.Blocks.trade_definition = {
    init() {
        this.jsonInit(this.definition());
        this.setDeletable(false);
        this.isInit = false;
    },
    definition() {
        return {
            message0: '%1 %2 %3',
            message1: '%1',
            message2: '%1 %2 %3',
            message3: '%1',
            message4: '%1 %2 %3',
            message5: '%1',
            message6: '%1',
            args0: [
                {
                    type: 'field_image',
                    src: defineContract,
                    width: 25,
                    height: 25,
                    alt: 'T',
                },
                {
                    type: 'field_label',
                    text: localize('1. Trade parameters'),
                    class: 'blocklyTextRootBlockHeader',
                },
                {
                    type: 'input_dummy',
                },
            ],
            args1: [
                {
                    type: 'input_statement',
                    name: 'TRADE_OPTIONS',
                },
            ],
            args2: [
                {
                    type: 'field_image',
                    src: ' ', // this is here to add extra padding
                    width: 4,
                    height: 25,
                },
                {
                    type: 'field_label',
                    text: localize('Run once at start:'),
                    class: 'blocklyTextRootBlockHeader',
                },
                {
                    type: 'input_dummy',
                },
            ],
            args3: [
                {
                    type: 'input_statement',
                    name: 'INITIALIZATION',
                    check: null,
                },
            ],
            args4: [
                {
                    type: 'field_image',
                    src: ' ', // this is here to add extra padding
                    width: 4,
                    height: 25,
                },
                {
                    type: 'field_label',
                    text: localize('Trade options:'),
                    class: 'blocklyTextRootBlockHeader',
                },
                {
                    type: 'input_dummy',
                },
            ],
            args5: [
                {
                    type: 'input_statement',
                    name: 'SUBMARKET',
                },
            ],
            args6: [
                {
                    type: 'field_image',
                    src: ' ', // this is here to add extra padding
                    width: 380,
                    height: 10,
                },
            ],
            colour: window.Blockly.Colours.RootBlock.colour,
            colourSecondary: window.Blockly.Colours.RootBlock.colourSecondary,
            colourTertiary: window.Blockly.Colours.RootBlock.colourTertiary,
            tooltip: localize('Here is where you define the parameters of your contract.'),
            category: window.Blockly.Categories.Trade_Definition,
        };
    },
    meta() {
        return {
            display_name: localize('Trade parameters'),
            description: localize('Here is where you define the parameters of your contract.'),
            key_words: localize('market, trade type, contract type'),
        };
    },
    customContextMenu(menu) {
        const menu_items = [localize('Enable Block'), localize('Disable Block')];
        excludeOptionFromContextMenu(menu, menu_items);
        modifyContextMenu(menu);
    },
    onchange(event) {
        if (event.type === window.Blockly.Events.SELECTED && !this.isInit) {
            this.isInit = true;
            initErrorHandlingListener('keydown');
        } else if (window.Blockly.getSelected() === null && this.isInit) {
            this.isInit = false;
            removeErrorHandlingEventListener('keydown');
        }
        if (!this.workspace || this.workspace.isDragging() || window.Blockly.derivWorkspace.isFlyoutVisible) {
            return;
        }

        if (
            event.type === window.Blockly.Events.BLOCK_CHANGE ||
            (event.type === window.Blockly.Events.BLOCK_DRAG && !event.isStart)
        ) {
            // Enforce only trade_definition_<type> blocks in TRADE_OPTIONS statement.
            const blocks_in_trade_options = this.getBlocksInStatement('TRADE_OPTIONS');

            if (blocks_in_trade_options.length > 0) {
                blocks_in_trade_options.forEach(block => {
                    if (!/^trade_definition_.+$/.test(block.type)) {
                        runIrreversibleEvents(() => {
                            block.unplug(true);
                        });
                    }
                });
            } else {
                runIrreversibleEvents(() => {
                    this.dispose();
                });
            }
        }
        if (this.isCollapsed()) {
            appendCollapsedMainBlocksFields(this);
        }
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.trade_definition = block => {
    const { client } = DBotStore.instance;

    if (!client || !client.is_logged_in) {
        throw new Error('Please login');
    }

    const { loginid } = client;
    const account = client.getToken(loginid);
    const market_block = block.getChildByType('trade_definition_market');
    const trade_type_block = block.getChildByType('trade_definition_tradetype');
    const contract_type_block = block.getChildByType('trade_definition_contracttype');
    const candle_interval_block = block.getChildByType('trade_definition_candleinterval');
    const restart_on_error_block = block.getChildByType('trade_definition_restartonerror');
    const restart_on_buy_sell_block = block.getChildByType('trade_definition_restartbuysell');

    const symbol = market_block.getFieldValue('SYMBOL_LIST');
    const trade_type = trade_type_block.getFieldValue('TRADETYPE_LIST');
    const contract_type = contract_type_block.getFieldValue('TYPE_LIST');
    const candle_interval = candle_interval_block.getFieldValue('CANDLEINTERVAL_LIST');
    const should_restart_on_error = restart_on_error_block.getFieldValue('RESTARTONERROR') !== 'FALSE';
    const should_restart_on_buy_sell = restart_on_buy_sell_block.getFieldValue('TIME_MACHINE_ENABLED') !== 'FALSE';

    const { opposites } = config();
    const contract_type_list =
        contract_type === 'both'
            ? opposites[trade_type.toUpperCase()].map(opposite => Object.keys(opposite)[0])
            : [contract_type];

    const initialization = window.Blockly.JavaScript.javascriptGenerator.statementToCode(block, 'INITIALIZATION');
    const trade_options_statement = window.Blockly.JavaScript.javascriptGenerator.statementToCode(block, 'SUBMARKET');

    const code = `  
    BinaryBotPrivateInit = function BinaryBotPrivateInit() {
        Bot.init('${account}', {
          symbol              : '${symbol}',
          contractTypes       : ${JSON.stringify(contract_type_list)},
          candleInterval      : '${candle_interval || 'FALSE'}',
          shouldRestartOnError: ${should_restart_on_error},
          timeMachineEnabled  : ${should_restart_on_buy_sell},
        });
        ${initialization.trim()}
    };
      BinaryBotPrivateStart = function BinaryBotPrivateStart() {
        BinaryBotPrivateHasCalledTradeOptions = false;
        Bot.highlightBlock('${block.id}');
        ${trade_options_statement.trim()}
      };\n`;
    return code;
};
