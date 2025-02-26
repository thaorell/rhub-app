import React, { useContext, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createSelector } from 'reselect';

import { loadUsageRequest } from '@ducks/lab/region/actions';
import { LabProductData } from '@ducks/lab/product/types';

import { AppState } from '@store';
import { Quota } from '@ducks/lab/types';

import Questionnaire from './Questionnaire';
import GraphsUtilization from './Graphs';
import {
  genQuotaExceededError,
  genTotalUsage,
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
  /** Set Errors */
  setErrors: React.Dispatch<React.SetStateAction<React.ReactNode[]>>;
  /** Append to Errors */
  addErrors: (
    errorMsg: string | React.ReactNode,
    isValidationErr?: boolean | undefined
  ) => void;
}

const selectProducts = (state: any): { [key: number]: LabProductData } =>
  state.labProduct.data;

const selectProdParam = createSelector(
  [selectProducts, (prods, productId) => productId],
  (products, productId) =>
    products[productId].parameters.filter((param) => !param.advanced)
);

const ClusterConfiguration: React.FC<Props> = ({
  onSubmit,
  totalUsage,
  setTotalUsage,
  setErrors,
  addErrors,
}: Props) => {
  const dispatch = useDispatch();
  const [wizardErrors, setWizardErrors, values] = useContext(wizardContext);
  // Addditional errors in addition to validation errors on the fields
  const productId = Number(values?.product_id);
  const regionId = Number(values.region_id);
  const quota = useSelector(
    (state: AppState) =>
      state.labRegion.product_regions.find(
        (value) => value.region.id === regionId
      )?.region.user_quota
  );
  const regionUsage = useSelector(
    (state: AppState) => state.labRegion.usage?.[regionId]?.user_quota_usage
  );
  const parameters = useSelector((state) => selectProdParam(state, productId));
  const product = useSelector(
    (state: AppState) => state.labProduct.data[productId]
  );
  const { flavors, name: prodName } = product;
  const formattedProdName = prodName.trim().replace(/\s/g, '').toLowerCase();
  useEffect(() => {
    dispatch(loadUsageRequest(regionId));
  }, [dispatch, regionId]);

  useEffect(() => {
    if (regionUsage && parameters) {
      const defaultUsage = genTotalUsage(
        parameters,
        regionUsage,
        flavors,
        values,
        undefined,
        undefined,
        formattedProdName
      );
      setTotalUsage(defaultUsage);
    }
  }, [
    regionUsage,
    parameters,
    flavors,
    values,
    formattedProdName,
    setTotalUsage,
  ]);

  useEffect(() => {
    if (totalUsage && quota) {
      const errorMsg = genQuotaExceededError(totalUsage, quota);
      if (errorMsg) {
        addErrors(errorMsg);
      } else {
        removeWizardErrors(wizardErrors, setWizardErrors, 'step-3-quota');
      }
    }
  }, [addErrors, quota, setErrors, setWizardErrors, totalUsage, wizardErrors]);

  // updateUsage takes future resources consumption from user inputs in the form and update usage state
  const updateUsage = (
    nodeCountMap: { [key: string]: number },
    selectedFlavor?: string
  ) => {
    if (regionUsage) {
      setTotalUsage(
        genTotalUsage(
          parameters,
          regionUsage,
          flavors,
          values,
          nodeCountMap,
          selectedFlavor,
          formattedProdName
        )
      );
    }
  };

  // Step 3 includes parameters that are not in advanced step
  return (
    <>
      <div style={{ display: 'flex' }}>
        <div>
          <StepHeader text="Cluster Configuration" />
          <p>Please enter basic configuration for your QuickCluster</p>
          <div className="configuration-step-border">
            <Questionnaire
              updateUsage={updateUsage}
              parameters={parameters}
              onSubmit={onSubmit}
              stepId={3}
            />
          </div>
        </div>

        {regionUsage && flavors && quota && (
          <GraphsUtilization
            regionId={regionId}
            vCPUCoreUsed={totalUsage?.num_vcpus}
            ramMbUsed={totalUsage?.ram_mb}
            volumesGbUsed={totalUsage?.volumes_gb}
            vCPUCoreQuota={quota.num_vcpus}
            ramMbQuota={quota.ram_mb}
            volumesGbQuota={quota.volumes_gb}
          />
        )}
      </div>
    </>
  );
};

export default ClusterConfiguration;
