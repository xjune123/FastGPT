import React, { useMemo } from 'react';
import { Flex, Box, Button } from '@chakra-ui/react';
import MyIcon from '@/components/Icon';

const ContextModal = ({
  current,
  total,
  onChange
}: {
  current: number;
  total: number;
  onChange: Function;
}) => {
  const btnStyle = {
    width: '30px',
    lineHeight: '30px',
    background: '#fff',
    borderRadius: '4px',
    marginRight: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const pageBth = useMemo(() => {
    const list = new Array(Math.ceil(total / 10)).fill(1);
    return list.map((item, index) => {
      return (
        <Box
          as="button"
          style={{
            ...btnStyle,
            background: index + 1 === current ? '#3370ff' : '#fff',
            color: index + 1 === current ? '#fff' : ''
          }}
          onClick={() => onChange(index + 1)}
        >
          {index + 1}
        </Box>
      );
    });
  }, [total, current]);

  const preChange = () => {
    onChange(current - 1);
  };

  const nextChange = () => {
    onChange(current + 1);
  };

  const nextDisbaled = useMemo(() => {
    return current === Math.ceil(total / 10);
  }, [current]);

  return (
    <Flex justifyContent={'center'} mt={'20px'}>
      <Box as="button" style={btnStyle} disabled={current === 1} onClick={() => preChange()}>
        <MyIcon name="arrow" transform={'rotate(90deg)'} />
      </Box>
      {pageBth}
      <Box as="button" style={btnStyle} disabled={nextDisbaled} onClick={() => nextChange()}>
        <MyIcon name="arrow" transform={'rotate(-90deg)'} />
      </Box>
    </Flex>
  );
};
export default ContextModal;
