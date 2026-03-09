import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type Props = {
  noMargin?: boolean;
};

export const TextBlock = styled('div')<Props>`
  line-height: 1.5;
  ${p => (p.noMargin ? '' : 'margin-bottom:' + space(3))};
`;
