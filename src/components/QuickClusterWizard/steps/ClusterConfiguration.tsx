import React, { useContext, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loadUsageRequest } from '@ducks/lab/region/actions';

import { AppState } from '@store';
import { Quota } from '@ducks/lab/types';
import { LabProductParams } from '@ducks/lab/product/types';
import { Alert, AlertGroup } from '@patternfly/react-core';

import Questionnaire from './Questionnaire';
import GraphsUtilization from './Graphs';
import {
  addWizardErrors,
  genGraphValues,
  genQuotaExceededError,
  removeWizardErrors,
  StepHeader,
  WizardValues,
} from '../helpers';
import { wizardContext } from '../QuickClusterWizard';

interface Props {
  /** Function to handle submit */
  onSubmit: (data: WizardValues) => void;
  /** Total resource consumptions */
  totalUsage: Quota;
  /** Update parent's totalUsage state */
  setTotalUsage: React.Dispatch<React.SetStateAction<Quota>>;
}

const ClusterConfiguration: React.FC<Props> = ({
  onSubmit,
  totalUsage,
  setTotalUsage,
}: Props) => {
  const dispatch = useDispatch();
  const [wizardErrors, setWizardErrors, values] = useContext(wizardContext);
  // Addditional errors in addition to validation errors on the fields
  const [error, setErrors] = useState<React.ReactNode[]>([]);
  const productId = Number(values?.product_id);
  const regionId = Number(values.region_id);
  const quota = useSelector(
    (state: AppState) =>
      state.labRegion.product_regions.find(
        (value) => value.region.id === regionId
      )?.region.user_quota
  );
  const regionUsage = useSelector(
    (state: AppState) => state.labRegion.usage?.user_quota_usage
  );
  const product = useSelector(
    (state: AppState) => state.labProduct.data[productId]
  );
  const parameters = product.parameters.filter((param) => !param.advanced);
  const { flavors } = product;

  const addErrors = (errorMsg: string) => {
    setErrors([
      ...error,
      <Alert
        key={errorMsg}
        variant="danger"
        title={errorMsg}
        aria-live="polite"
        isInline
        timeout={15000}
      />,
    ]);
    addWizardErrors(wizardErrors, setWizardErrors, 'step-3-quota');
  };

  useEffect(() => {
    dispatch(loadUsageRequest(regionId));
  }, [dispatch, regionId]);

  useEffect(() => {
    if (regionUsage && parameters) {
      const nodeParams = parameters.filter(
        (param) =>
          param.variable.indexOf('_nodes') !== -1 &&
          param.variable.indexOf('num') !== -1
      );
      const defaultUsage = nodeParams.reduce(
        (data: Quota, currentParam: LabProductParams) => {
          // If selection exists, generate graph values based on this value instead of default value
          const prevSelection = values[currentParam.variable];
          const thisUsage = genGraphValues(
            currentParam.variable,
            prevSelection
              ? Number(prevSelection)
              : Number(currentParam.default),
            flavors
          );
          return {
            num_vcpus: data.num_vcpus + thisUsage.num_vcpus,
            ram_mb: data.ram_mb + thisUsage.ram_mb,
            volumes_gb: data.volumes_gb + thisUsage.volumes_gb,
            num_volumes: data.num_volumes + thisUsage.num_volumes,
          };
        },
        regionUsage
      );
      setTotalUsage(defaultUsage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameters.length, regionUsage, product.name, quota]);

  useEffect(() => {
    if (totalUsage && quota) {
      const errorMsg = genQuotaExceededError(totalUsage, quota);
      if (errorMsg) {
        addErrors(errorMsg);
      } else {
        setErrors([]);
        removeWizardErrors(wizardErrors, setWizardErrors, 'step-3-quota');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quota, totalUsage]);

  // updateUsage takes future resources consumption from user inputs in the form and update usage state
  const updateUsage = (requiredResources: Quota) => {
    if (regionUsage) {
      setTotalUsage({
        num_vcpus: regionUsage.num_vcpus + requiredResources.num_vcpus,
        ram_mb: regionUsage.ram_mb + requiredResources.ram_mb,
        volumes_gb: regionUsage.volumes_gb + requiredResources.volumes_gb,
        num_volumes: regionUsage.num_volumes + requiredResources.num_volumes,
      });
    }
  };

  // Step 3 includes parameters that are not in advanced step
  return (
    <>
      <StepHeader text="Cluster Configuration" />
      <p>Please enter basic configuration for your QuickCluster</p>
      {regionUsage && quota && flavors && (
        <>
          <AlertGroup isToast isLiveRegion>
            {error}
          </AlertGroup>
          <div className="configuration-step-border">
            <Questionnaire
              updateUsage={updateUsage}
              parameters={parameters}
              onSubmit={onSubmit}
              stepId={3}
            />
          </div>
          <GraphsUtilization
            vCPUCoreUsed={totalUsage?.num_vcpus}
            ramMbUsed={totalUsage?.ram_mb}
            volumesGbUsed={totalUsage?.volumes_gb}
            vCPUCoreQuota={quota.num_vcpus}
            ramMbQuota={quota.ram_mb}
            volumesGbQuota={quota.volumes_gb}
          />
        </>
      )}
    </>
  );
};

export default ClusterConfiguration;