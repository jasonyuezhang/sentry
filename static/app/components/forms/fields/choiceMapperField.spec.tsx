import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';

import ChoiceMapperField from './choiceMapperField';

describe('ChoiceMapperField', () => {
  const defaultProps = {
    name: 'choice-mapper',
    label: 'Choice Mapper',
    addButtonText: 'Add Item',
    addDropdown: {
      items: [
        {value: 'alpha', label: 'Alpha'},
        {value: 'beta', label: 'Beta'},
      ],
    },
    mappedColumnLabel: 'Integration',
    columnLabels: {
      env: 'Environment',
      priority: 'Priority',
    },
    mappedSelectors: {
      env: {
        options: [
          {value: 'prod', label: 'Production'},
          {value: 'dev', label: 'Development'},
        ],
      },
      priority: {
        options: [
          {value: 'high', label: 'High'},
          {value: 'low', label: 'Low'},
        ],
      },
    },
  };

  it('adds accessible names to row controls', async () => {
    const model = new FormModel();

    render(
      <Form model={model}>
        <ChoiceMapperField {...defaultProps} />
      </Form>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Add Item'}));
    await userEvent.click(screen.getByRole('option', {name: 'Alpha'}));

    expect(screen.getByRole('textbox', {name: 'Alpha Environment'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Alpha Priority'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Delete Alpha'})).toBeInTheDocument();
  });

  it('saves changes through the labeled selects', async () => {
    const model = new FormModel();

    render(
      <Form model={model}>
        <ChoiceMapperField {...defaultProps} />
      </Form>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Add Item'}));
    await userEvent.click(screen.getByRole('option', {name: 'Alpha'}));

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Alpha Environment'}),
      'Production'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Alpha Priority'}),
      'High'
    );

    expect(model.getValue('choice-mapper')).toEqual({
      alpha: {
        env: 'prod',
        priority: 'high',
      },
    });
  });
});
