import React, { useMemo } from 'react';
import { ModalBody, Flex, Box, useTheme, ModalFooter, Button } from '@chakra-ui/react';
import MyModal from '@/components/MyModal';
import { getMyModels } from '@/web/core/api/app';
import { useQuery } from '@tanstack/react-query';
import type { SelectAppItemType } from '@/types/core/app/flow';
import Avatar from '@/components/Avatar';
import { useTranslation } from 'react-i18next';
import { useLoading } from '@/web/common/hooks/useLoading';

const SelectAppModal = ({
  defaultApps = [],
  filterApps = [],
  max = 1,
  onClose,
  onSuccess
}: {
  defaultApps: string[];
  filterApps?: string[];
  max?: number;
  onClose: () => void;
  onSuccess: (e: SelectAppItemType[]) => void;
}) => {
  const { t } = useTranslation();
  const { Loading } = useLoading();
  const theme = useTheme();
  const [selectedApps, setSelectedApps] = React.useState<string[]>(defaultApps);
  /* 加载模型 */
  const { data = [], isLoading } = useQuery(['loadMyApos'], () => getMyModels());

  const apps = useMemo(
    () => data.filter((app) => !filterApps.includes(app._id)),
    [data, filterApps]
  );

  return (
    <MyModal
      isOpen
      title={`选择应用${max > 1 ? `(${selectedApps.length}/${max})` : ''}`}
      onClose={onClose}
      w={'700px'}
      position={'relative'}
    >
      <ModalBody
        minH={'300px'}
        display={'grid'}
        gridTemplateColumns={['1fr', 'repeat(3,1fr)']}
        gridGap={4}
      >
        {apps.map((app) => (
          <Flex
            key={app._id}
            alignItems={'center'}
            border={theme.borders.base}
            borderRadius={'md'}
            px={1}
            py={2}
            cursor={'pointer'}
            {...(selectedApps.includes(app._id)
              ? {
                  bg: 'myBlue.200',
                  onClick: () => {
                    setSelectedApps(selectedApps.filter((e) => e !== app._id));
                  }
                }
              : {
                  onClick: () => {
                    if (max === 1) {
                      setSelectedApps([app._id]);
                    } else if (selectedApps.length < max) {
                      setSelectedApps([...selectedApps, app._id]);
                    }
                  }
                })}
          >
            <Avatar src={app.avatar} w={['16px', '22px']} />
            <Box fontWeight={'bold'} ml={1}>
              {app.name}
            </Box>
          </Flex>
        ))}
      </ModalBody>
      <ModalFooter>
        <Button variant={'base'} onClick={onClose}>
          {t('Cancel')}
        </Button>
        <Button
          ml={2}
          onClick={() => {
            onSuccess(
              apps
                .filter((app) => selectedApps.includes(app._id))
                .map((app) => ({
                  id: app._id,
                  name: app.name,
                  logo: app.avatar
                }))
            );
            onClose();
          }}
        >
          {t('Confirm')}
        </Button>
      </ModalFooter>
      <Loading loading={isLoading} fixed={false} />
    </MyModal>
  );
};

export default React.memo(SelectAppModal);
